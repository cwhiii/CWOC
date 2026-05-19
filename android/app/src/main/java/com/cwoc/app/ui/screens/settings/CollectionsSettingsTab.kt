package com.cwoc.app.ui.screens.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

// --- Default color palette (matches web CWOC defaults) ---
private val DEFAULT_COLORS = listOf(
    "#D4A574", "#8B6914", "#6B4E31", "#4A7C59", "#2E5A3C",
    "#4A6FA5", "#2C4A7C", "#7B4F8A", "#5C3D6E", "#C75B39",
    "#8B3A3A", "#D4A017", "#5F8A8B", "#8B7355", "#6B8E23",
    "#CD853F", "#708090", "#B8860B", "#556B2F", "#8FBC8F"
)

// --- Notification offset presets ---
private val NOTIFICATION_OFFSETS = listOf(
    "5 minutes before" to 5,
    "10 minutes before" to 10,
    "15 minutes before" to 15,
    "30 minutes before" to 30,
    "1 hour before" to 60,
    "2 hours before" to 120,
    "1 day before" to 1440,
    "2 days before" to 2880,
    "1 week before" to 10080
)

// Tag color palette matching web implementation (bg/fg pairs)
private data class PaletteColor(val bg: String, val fg: String)

private val TAG_COLOR_PALETTE = listOf(
    PaletteColor("#8b5a2b", "#fff8e1"),
    PaletteColor("#a0522d", "#fff8e1"),
    PaletteColor("#4a2c2a", "#fdf5e6"),
    PaletteColor("#6b4e31", "#fff8e1"),
    PaletteColor("#b22222", "#fff8e1"),
    PaletteColor("#8b0000", "#fdf5e6"),
    PaletteColor("#2e4057", "#fdf5e6"),
    PaletteColor("#1b4332", "#e8dcc8"),
    PaletteColor("#5c4033", "#faebd7"),
    PaletteColor("#d4af37", "#2b1e0f"),
    PaletteColor("#c4a484", "#2b1e0f"),
    PaletteColor("#e8dcc8", "#4a2c2a"),
    PaletteColor("#d2b48c", "#2b1e0f"),
    PaletteColor("#f5e6cc", "#4a2c2a"),
    PaletteColor("#fff8e1", "#4a2c2a")
)

// Font color swatches matching web implementation
private val FONT_COLOR_SWATCHES = listOf(
    "#2b1e0f", "#4a2c2a", "#5c3317", "#fff8e1", "#fdf5e6",
    "#faebd7", "#e8dcc8", "#000000", "#ffffff"
)

/**
 * Collections settings tab with 4 collapsible sections:
 * Tag Editor, Custom Colors, Saved Locations, Default Notifications.
 *
 * Validates: Requirements 4.1
 */
@Composable
fun CollectionsSettingsTab(
    settingsState: SettingsFormState,
    onUpdateSetting: (key: String, value: String) -> Unit
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Section 1: Tag Editor
        TagEditorSection(
            sharedTagsJson = settingsState.sharedTags,
            onTagsChanged = { onUpdateSetting("shared_tags", it) }
        )

        HorizontalDivider()

        // Section 2: Custom Colors
        CustomColorsSection(
            customColorsJson = settingsState.customColors,
            onColorsChanged = { onUpdateSetting("custom_colors", it) },
            chitOptionsJson = settingsState.chitOptions,
            overdueBorderColor = settingsState.overdueBorderColor,
            blockedBorderColor = settingsState.blockedBorderColor,
            onOverdueBorderColorChanged = { onUpdateSetting("overdue_border_color", it) },
            onBlockedBorderColorChanged = { onUpdateSetting("blocked_border_color", it) }
        )

        HorizontalDivider()

        // Section 3: Saved Locations
        SavedLocationsSection(
            savedLocationsJson = settingsState.savedLocations,
            onLocationsChanged = { onUpdateSetting("saved_locations", it) }
        )

        HorizontalDivider()

        // Section 4: Default Notifications
        DefaultNotificationsSection(
            notificationsJson = settingsState.defaultNotifications,
            onNotificationsChanged = { onUpdateSetting("default_notifications", it) }
        )
    }
}

// ============================================================
// Collapsible Section Header
// ============================================================

@Composable
private fun CollapsibleSectionHeader(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggle() }
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f)
        )
        Icon(
            imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
            contentDescription = if (expanded) "Collapse" else "Expand"
        )
    }
}

// ============================================================
// Section 1: Tag Editor
// ============================================================

/**
 * Tag Editor section: displays hierarchical tag list with color swatches,
 * supports create/edit/delete via dialogs.
 * Requirement 15.1: Hierarchical tree structure with / delimiter.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TagEditorSection(
    sharedTagsJson: String,
    onTagsChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingTagIndex by remember { mutableStateOf<Int?>(null) }
    var showDeleteConfirm by remember { mutableStateOf<Int?>(null) }

    val tags = remember(sharedTagsJson) { parseTagsJson(sharedTagsJson) }
    val tagTree = remember(tags) { buildTagTree(tags) }

    Column {
        CollapsibleSectionHeader(
            title = "🏷️ Tag Editor",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (tags.isEmpty()) {
                    Text(
                        text = "No tags defined. Add one to get started.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    // Render hierarchical tree
                    tagTree.forEach { node ->
                        TagTreeNodeRow(
                            node = node,
                            depth = 0,
                            tags = tags,
                            onEdit = { tagIndex -> editingTagIndex = tagIndex },
                            onDelete = { tagIndex -> showDeleteConfirm = tagIndex }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(onClick = { showAddDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Tag")
                }
            }
        }
    }

    // Add Tag Dialog
    if (showAddDialog) {
        EnhancedTagEditDialog(
            title = "Add Tag",
            initialTag = TagItem(name = "", color = DEFAULT_COLORS.first(), fontColor = "#5c3317"),
            availableParents = tags.map { it.name },
            allTags = tags,
            onDismiss = { showAddDialog = false },
            onConfirm = { updatedTag ->
                // Reserved tag prefix check (matching web's isReservedTagPrefix)
                if (updatedTag.name.startsWith("CWOC_System/")) {
                    // Can't create — silently reject (web shows toast but we're in a dialog)
                    return@EnhancedTagEditDialog
                }
                val newTags = tags + updatedTag
                onTagsChanged(serializeTagsJson(newTags))
                showAddDialog = false
            }
        )
    }

    // Edit Tag Dialog
    editingTagIndex?.let { index ->
        val tag = tags[index]
        EnhancedTagEditDialog(
            title = "Edit Tag",
            initialTag = tag,
            availableParents = tags.filter { it.name != tag.name }.map { it.name },
            allTags = tags,
            onDismiss = { editingTagIndex = null },
            onConfirm = { updatedTag ->
                val newTags = tags.toMutableList()
                newTags[index] = updatedTag
                onTagsChanged(serializeTagsJson(newTags))
                editingTagIndex = null
            }
        )
    }

    // Delete Confirmation
    showDeleteConfirm?.let { index ->
        val tag = tags[index]
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            title = { Text("Delete Tag") },
            text = { Text("Are you sure you want to delete \"${tag.name}\"? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    val newTags = tags.toMutableList()
                    newTags.removeAt(index)
                    onTagsChanged(serializeTagsJson(newTags))
                    showDeleteConfirm = null
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

/**
 * Recursive composable for rendering a tag tree node with expand/collapse.
 * Requirement 15.1: Hierarchical tree with expand/collapse per parent.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TagTreeNodeRow(
    node: TagTreeNode,
    depth: Int,
    tags: List<TagItem>,
    onEdit: (Int) -> Unit,
    onDelete: (Int) -> Unit
) {
    var isExpanded by remember { mutableStateOf(true) }
    val hasChildren = node.children.isNotEmpty()

    Column {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = (depth * 16).dp)
                .combinedClickable(
                    onClick = {
                        if (node.tagIndex != null) {
                            onEdit(node.tagIndex)
                        } else if (hasChildren) {
                            isExpanded = !isExpanded
                        }
                    },
                    onLongClick = {
                        if (node.tagIndex != null) {
                            onDelete(node.tagIndex)
                        }
                    }
                ),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Expand/collapse toggle for parents
                if (hasChildren) {
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowRight,
                        contentDescription = if (isExpanded) "Collapse" else "Expand",
                        modifier = Modifier
                            .size(20.dp)
                            .clickable { isExpanded = !isExpanded },
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                } else {
                    Spacer(modifier = Modifier.width(24.dp))
                }

                // Color swatch
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .background(parseHexColor(node.color ?: "#808080"))
                )
                Spacer(modifier = Modifier.width(8.dp))

                // Favorite star
                if (node.favorite) {
                    Text(
                        text = "★",
                        color = Color(0xFFDAA520),
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                }

                // Tag name (just the segment, not full path)
                Text(
                    text = node.name,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f)
                )

                // Child count indicator
                if (hasChildren) {
                    Text(
                        text = "${node.children.size}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                }

                // Edit icon for items with a tag index
                if (node.tagIndex != null) {
                    IconButton(
                        onClick = { onEdit(node.tagIndex) },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = "Edit",
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        // Render children if expanded
        if (hasChildren && isExpanded) {
            node.children.forEach { child ->
                Spacer(modifier = Modifier.height(4.dp))
                TagTreeNodeRow(
                    node = child,
                    depth = depth + 1,
                    tags = tags,
                    onEdit = onEdit,
                    onDelete = onDelete
                )
            }
        }
    }
}

/**
 * Enhanced Tag Edit Dialog with:
 * - Favorite star toggle (Req 15.2)
 * - Sharing section with user picker, role selector (Req 15.3, 15.4)
 * - Font Color picker with preset swatches (Req 15.5)
 * - Preview chip with live color update (Req 15.6)
 * - Free-form hex color input with validation (Req 15.7)
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun EnhancedTagEditDialog(
    title: String,
    initialTag: TagItem,
    availableParents: List<String>,
    allTags: List<TagItem>,
    onDismiss: () -> Unit,
    onConfirm: (TagItem) -> Unit
) {
    var name by remember { mutableStateOf(initialTag.name) }
    var selectedBgColor by remember { mutableStateOf(initialTag.color) }
    var selectedFontColor by remember { mutableStateOf(initialTag.fontColor) }
    var selectedParent by remember { mutableStateOf(initialTag.parent) }
    var isFavorite by remember { mutableStateOf(initialTag.favorite) }
    var shares by remember { mutableStateOf(initialTag.shares) }
    var parentExpanded by remember { mutableStateOf(false) }

    // Hex input state
    var bgHexInput by remember { mutableStateOf(selectedBgColor) }
    var fgHexInput by remember { mutableStateOf(selectedFontColor) }
    var bgHexError by remember { mutableStateOf(false) }
    var fgHexError by remember { mutableStateOf(false) }

    // Sharing state
    var shareUserInput by remember { mutableStateOf("") }
    var shareRole by remember { mutableStateOf("viewer") }
    var shareRoleExpanded by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, modifier = Modifier.weight(1f))
                // Favorite star toggle (Req 15.2)
                IconButton(onClick = { isFavorite = !isFavorite }) {
                    Text(
                        text = if (isFavorite) "★" else "☆",
                        style = MaterialTheme.typography.headlineSmall,
                        color = if (isFavorite) Color(0xFFDAA520) else Color.Gray
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Tag Name
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tag Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Preview chip (Req 15.6) — updates within 100ms of color change
                Text("Preview", style = MaterialTheme.typography.labelMedium)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(parseHexColor(selectedBgColor))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = name.ifBlank { "Tag Preview" },
                        color = parseHexColor(selectedFontColor),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                }

                HorizontalDivider()

                // Background Color section
                Text("Background Color", style = MaterialTheme.typography.labelMedium)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    TAG_COLOR_PALETTE.forEach { paletteColor ->
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(parseHexColor(paletteColor.bg))
                                .then(
                                    if (paletteColor.bg == selectedBgColor) {
                                        Modifier.border(3.dp, MaterialTheme.colorScheme.primary, CircleShape)
                                    } else {
                                        Modifier.border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                                    }
                                )
                                .clickable {
                                    selectedBgColor = paletteColor.bg
                                    bgHexInput = paletteColor.bg
                                    bgHexError = false
                                    // Also set font color from palette pair
                                    selectedFontColor = paletteColor.fg
                                    fgHexInput = paletteColor.fg
                                    fgHexError = false
                                }
                        )
                    }
                }

                // Hex input for background (Req 15.7)
                OutlinedTextField(
                    value = bgHexInput,
                    onValueChange = { input ->
                        bgHexInput = input
                        val normalized = input.removePrefix("#")
                        if (normalized.matches(Regex("^[0-9A-Fa-f]{6}$"))) {
                            selectedBgColor = "#$normalized"
                            bgHexError = false
                        } else {
                            bgHexError = input.isNotEmpty()
                        }
                    },
                    label = { Text("Hex (e.g. #8b5a2b)") },
                    isError = bgHexError,
                    supportingText = if (bgHexError) {{ Text("Invalid hex color") }} else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                HorizontalDivider()

                // Font Color section (Req 15.5)
                Text("Font Color", style = MaterialTheme.typography.labelMedium)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    FONT_COLOR_SWATCHES.forEach { fgColor ->
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(parseHexColor(fgColor))
                                .then(
                                    if (fgColor == selectedFontColor) {
                                        Modifier.border(3.dp, MaterialTheme.colorScheme.primary, CircleShape)
                                    } else {
                                        Modifier.border(
                                            1.dp,
                                            if (isLightColor(fgColor)) MaterialTheme.colorScheme.outline else Color.Transparent,
                                            CircleShape
                                        )
                                    }
                                )
                                .clickable {
                                    selectedFontColor = fgColor
                                    fgHexInput = fgColor
                                    fgHexError = false
                                }
                        )
                    }
                }

                // Hex input for font color (Req 15.7)
                OutlinedTextField(
                    value = fgHexInput,
                    onValueChange = { input ->
                        fgHexInput = input
                        val normalized = input.removePrefix("#")
                        if (normalized.matches(Regex("^[0-9A-Fa-f]{6}$"))) {
                            selectedFontColor = "#$normalized"
                            fgHexError = false
                        } else {
                            fgHexError = input.isNotEmpty()
                        }
                    },
                    label = { Text("Hex (e.g. #5c3317)") },
                    isError = fgHexError,
                    supportingText = if (fgHexError) {{ Text("Invalid hex color") }} else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                HorizontalDivider()

                // Sharing section (Req 15.3, 15.4)
                Text(
                    text = "🔗 Sharing",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                // Current shares list
                if (shares.isEmpty()) {
                    Text(
                        text = "Not shared with anyone",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    shares.forEach { share ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = share.displayName.ifEmpty { share.userId },
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f)
                            )
                            // Role badge
                            Text(
                                text = if (share.role == "manager") "✏️ Manager" else "👁️ Viewer",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            // Remove button (Req 15.4)
                            IconButton(
                                onClick = {
                                    shares = shares.filter { it.userId != share.userId }
                                },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Remove share",
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }

                // Add share controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // User picker
                    OutlinedTextField(
                        value = shareUserInput,
                        onValueChange = { shareUserInput = it },
                        label = { Text("User") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )

                    // Role selector
                    ExposedDropdownMenuBox(
                        expanded = shareRoleExpanded,
                        onExpandedChange = { shareRoleExpanded = !shareRoleExpanded }
                    ) {
                        OutlinedTextField(
                            value = if (shareRole == "manager") "Manager" else "Viewer",
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .menuAnchor()
                                .width(100.dp),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = shareRoleExpanded) }
                        )
                        ExposedDropdownMenu(
                            expanded = shareRoleExpanded,
                            onDismissRequest = { shareRoleExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("👁️ Viewer") },
                                onClick = {
                                    shareRole = "viewer"
                                    shareRoleExpanded = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("✏️ Manager") },
                                onClick = {
                                    shareRole = "manager"
                                    shareRoleExpanded = false
                                }
                            )
                        }
                    }
                }

                // Share button
                Button(
                    onClick = {
                        if (shareUserInput.isNotBlank()) {
                            val alreadyShared = shares.any {
                                it.userId == shareUserInput || it.displayName == shareUserInput
                            }
                            if (!alreadyShared) {
                                shares = shares + TagShare(
                                    userId = shareUserInput,
                                    role = shareRole,
                                    displayName = shareUserInput
                                )
                                shareUserInput = ""
                            }
                        }
                    },
                    enabled = shareUserInput.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("➕ Share")
                }

                // Parent dropdown (optional)
                if (availableParents.isNotEmpty()) {
                    HorizontalDivider()
                    ExposedDropdownMenuBox(
                        expanded = parentExpanded,
                        onExpandedChange = { parentExpanded = !parentExpanded }
                    ) {
                        OutlinedTextField(
                            value = if (selectedParent.isEmpty()) "(None)" else selectedParent,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Parent Tag (optional)") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = parentExpanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = parentExpanded,
                            onDismissRequest = { parentExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("(None)") },
                                onClick = {
                                    selectedParent = ""
                                    parentExpanded = false
                                }
                            )
                            availableParents.forEach { parent ->
                                DropdownMenuItem(
                                    text = { Text(parent) },
                                    onClick = {
                                        selectedParent = parent
                                        parentExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        TagItem(
                            name = name,
                            color = selectedBgColor,
                            parent = selectedParent,
                            fontColor = selectedFontColor,
                            favorite = isFavorite,
                            shares = shares
                        )
                    )
                },
                enabled = name.isNotBlank() && !bgHexError && !fgHexError
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

// ============================================================
// Section 2: Custom Colors
// ============================================================

/**
 * Custom Colors section: shows default palette + user-defined colors,
 * supports add (hex input), edit, delete, and overdue/blocked border color assignment.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CustomColorsSection(
    customColorsJson: String,
    onColorsChanged: (String) -> Unit,
    chitOptionsJson: String,
    overdueBorderColor: String,
    blockedBorderColor: String,
    onOverdueBorderColorChanged: (String) -> Unit,
    onBlockedBorderColorChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingColorIndex by remember { mutableStateOf<Int?>(null) }
    // Track which color swatch was tapped for border assignment popup
    var borderAssignPopupColor by remember { mutableStateOf<String?>(null) }

    val customColors = remember(customColorsJson) { parseColorsJson(customColorsJson) }

    // Parse highlight settings from chitOptions JSON
    val highlightOverdueEnabled = remember(chitOptionsJson) {
        try {
            val obj = JSONObject(chitOptionsJson)
            obj.optBoolean("highlight_overdue_chits", true)
        } catch (e: Exception) { true }
    }
    val highlightBlockedEnabled = remember(chitOptionsJson) {
        try {
            val obj = JSONObject(chitOptionsJson)
            obj.optBoolean("highlight_blocked_chits", true)
        } catch (e: Exception) { true }
    }

    // All swatches (default + custom) for border color display
    val allSwatches = DEFAULT_COLORS + customColors

    Column {
        CollapsibleSectionHeader(
            title = "🎨 Custom Colors",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Default palette
                Text(
                    text = "Default Palette",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DEFAULT_COLORS.forEach { color ->
                        ColorSwatchWithBorderIndicator(
                            color = color,
                            isOverdue = overdueBorderColor.equals(color, ignoreCase = true),
                            isBlocked = blockedBorderColor.equals(color, ignoreCase = true),
                            onClick = {
                                if (highlightOverdueEnabled || highlightBlockedEnabled) {
                                    borderAssignPopupColor = color
                                }
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // User-defined colors
                Text(
                    text = "Custom Colors",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (customColors.isEmpty()) {
                    Text(
                        text = "No custom colors defined.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        customColors.forEachIndexed { index, color ->
                            ColorSwatchWithBorderIndicator(
                                color = color,
                                isOverdue = overdueBorderColor.equals(color, ignoreCase = true),
                                isBlocked = blockedBorderColor.equals(color, ignoreCase = true),
                                isCustom = true,
                                onClick = {
                                    if (highlightOverdueEnabled || highlightBlockedEnabled) {
                                        borderAssignPopupColor = color
                                    } else {
                                        // If neither highlight is enabled, fall back to edit behavior
                                        editingColorIndex = index
                                    }
                                },
                                onLongClick = { editingColorIndex = index }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(onClick = { showAddDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Color")
                }
            }
        }
    }

    // Border Color Assignment Popup
    borderAssignPopupColor?.let { color ->
        BorderColorAssignmentDialog(
            color = color,
            showOverdueOption = highlightOverdueEnabled,
            showBlockedOption = highlightBlockedEnabled,
            onAssignOverdue = {
                onOverdueBorderColorChanged(color)
                borderAssignPopupColor = null
            },
            onAssignBlocked = {
                onBlockedBorderColorChanged(color)
                borderAssignPopupColor = null
            },
            onDismiss = { borderAssignPopupColor = null }
        )
    }

    // Add Color Dialog
    if (showAddDialog) {
        ColorEditDialog(
            title = "Add Custom Color",
            initialHex = "#",
            onDismiss = { showAddDialog = false },
            onConfirm = { hex ->
                val newColors = customColors + hex
                onColorsChanged(serializeColorsJson(newColors))
                showAddDialog = false
            }
        )
    }

    // Edit Color Dialog
    editingColorIndex?.let { index ->
        ColorEditDialog(
            title = "Edit Color",
            initialHex = customColors[index],
            showDelete = true,
            onDismiss = { editingColorIndex = null },
            onConfirm = { hex ->
                val newColors = customColors.toMutableList()
                newColors[index] = hex
                onColorsChanged(serializeColorsJson(newColors))
                editingColorIndex = null
            },
            onDelete = {
                val newColors = customColors.toMutableList()
                newColors.removeAt(index)
                onColorsChanged(serializeColorsJson(newColors))
                editingColorIndex = null
            }
        )
    }
}

/**
 * A color swatch that displays ring outlines when assigned as overdue/blocked border color.
 * Supports double ring if same swatch is assigned to both.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ColorSwatchWithBorderIndicator(
    color: String,
    isOverdue: Boolean,
    isBlocked: Boolean,
    isCustom: Boolean = false,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null
) {
    val swatchSize = if (isCustom) 40.dp else 32.dp
    val shape = if (isCustom) RoundedCornerShape(8.dp) else CircleShape

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Box(
            modifier = Modifier
                .then(
                    when {
                        isOverdue && isBlocked -> {
                            // Double ring: outer ring for overdue, inner ring for blocked
                            Modifier
                                .size(swatchSize + 12.dp)
                                .border(2.dp, Color(0xFFFF4444), shape)
                                .padding(3.dp)
                                .border(2.dp, Color(0xFFFF8800), shape)
                                .padding(3.dp)
                        }
                        isOverdue -> {
                            // Single ring for overdue
                            Modifier
                                .size(swatchSize + 8.dp)
                                .border(2.dp, Color(0xFFFF4444), shape)
                                .padding(3.dp)
                        }
                        isBlocked -> {
                            // Single ring for blocked
                            Modifier
                                .size(swatchSize + 8.dp)
                                .border(2.dp, Color(0xFFFF8800), shape)
                                .padding(3.dp)
                        }
                        else -> Modifier.size(swatchSize)
                    }
                )
                .clip(shape)
                .background(parseHexColor(color))
                .border(1.dp, MaterialTheme.colorScheme.outline, shape)
                .then(
                    if (onLongClick != null) {
                        Modifier.combinedClickable(
                            onClick = onClick,
                            onLongClick = onLongClick
                        )
                    } else {
                        Modifier.clickable { onClick() }
                    }
                ),
            contentAlignment = Alignment.Center
        ) {}

        // Labels below the swatch
        if (isOverdue && isBlocked) {
            Text(
                text = "Overdue",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFFFF4444),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Blocked",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFFFF8800),
                fontWeight = FontWeight.Bold
            )
        } else if (isOverdue) {
            Text(
                text = "Overdue",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFFFF4444),
                fontWeight = FontWeight.Bold
            )
        } else if (isBlocked) {
            Text(
                text = "Blocked",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFFFF8800),
                fontWeight = FontWeight.Bold
            )
        }
    }
}

/**
 * Dialog for assigning a color as overdue or blocked border color.
 * Options are conditionally visible based on highlight settings.
 */
@Composable
private fun BorderColorAssignmentDialog(
    color: String,
    showOverdueOption: Boolean,
    showBlockedOption: Boolean,
    onAssignOverdue: () -> Unit,
    onAssignBlocked: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Assign Border Color") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Preview of the selected color
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Color: ", style = MaterialTheme.typography.bodyMedium)
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(parseHexColor(color))
                            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Assign this color as a border indicator:",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        },
        confirmButton = {
            Column {
                if (showOverdueOption) {
                    TextButton(onClick = onAssignOverdue) {
                        Text("Overdue Border")
                    }
                }
                if (showBlockedOption) {
                    TextButton(onClick = onAssignBlocked) {
                        Text("Blocked Border")
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun ColorEditDialog(
    title: String,
    initialHex: String,
    showDelete: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (hex: String) -> Unit,
    onDelete: (() -> Unit)? = null
) {
    var hexValue by remember { mutableStateOf(initialHex) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = hexValue,
                    onValueChange = { hexValue = it },
                    label = { Text("Hex Color (e.g. #FF5733)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                // Preview
                if (hexValue.length >= 4) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Preview: ", style = MaterialTheme.typography.bodySmall)
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(parseHexColor(hexValue))
                                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp))
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(hexValue) },
                enabled = hexValue.matches(Regex("^#[0-9A-Fa-f]{3,8}$"))
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            Row {
                if (showDelete && onDelete != null) {
                    TextButton(onClick = onDelete) {
                        Text("Delete", color = MaterialTheme.colorScheme.error)
                    }
                }
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        }
    )
}

// ============================================================
// Section 3: Saved Locations
// ============================================================

/**
 * Saved Locations section: list with name/address/coordinates,
 * radio for default, add/edit/delete.
 */
@Composable
private fun SavedLocationsSection(
    savedLocationsJson: String,
    onLocationsChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingLocationIndex by remember { mutableStateOf<Int?>(null) }
    var showDeleteConfirm by remember { mutableStateOf<Int?>(null) }

    val locations = remember(savedLocationsJson) { parseLocationsJson(savedLocationsJson) }

    Column {
        CollapsibleSectionHeader(
            title = "📍 Saved Locations",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (locations.isEmpty()) {
                    Text(
                        text = "No saved locations. Add one to get started.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    locations.forEachIndexed { index, location ->
                        LocationRow(
                            location = location,
                            onSetDefault = {
                                val newLocations = locations.mapIndexed { i, loc ->
                                    loc.copy(isDefault = i == index)
                                }
                                onLocationsChanged(serializeLocationsJson(newLocations))
                            },
                            onEdit = { editingLocationIndex = index },
                            onDelete = { showDeleteConfirm = index }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(onClick = { showAddDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Location")
                }
            }
        }
    }

    // Add Location Dialog
    if (showAddDialog) {
        LocationEditDialog(
            title = "Add Location",
            initialName = "",
            initialAddress = "",
            onDismiss = { showAddDialog = false },
            onConfirm = { name, address ->
                val newLocations = locations + LocationItem(
                    name = name,
                    address = address,
                    lat = 0.0,
                    lon = 0.0,
                    isDefault = locations.isEmpty()
                )
                onLocationsChanged(serializeLocationsJson(newLocations))
                showAddDialog = false
            }
        )
    }

    // Edit Location Dialog
    editingLocationIndex?.let { index ->
        val location = locations[index]
        LocationEditDialog(
            title = "Edit Location",
            initialName = location.name,
            initialAddress = location.address,
            onDismiss = { editingLocationIndex = null },
            onConfirm = { name, address ->
                val newLocations = locations.toMutableList()
                newLocations[index] = location.copy(name = name, address = address)
                onLocationsChanged(serializeLocationsJson(newLocations))
                editingLocationIndex = null
            }
        )
    }

    // Delete Confirmation
    showDeleteConfirm?.let { index ->
        val location = locations[index]
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = null },
            title = { Text("Delete Location") },
            text = { Text("Are you sure you want to delete \"${location.name}\"?") },
            confirmButton = {
                TextButton(onClick = {
                    val newLocations = locations.toMutableList()
                    newLocations.removeAt(index)
                    // If we deleted the default, make the first one default
                    if (location.isDefault && newLocations.isNotEmpty()) {
                        newLocations[0] = newLocations[0].copy(isDefault = true)
                    }
                    onLocationsChanged(serializeLocationsJson(newLocations))
                    showDeleteConfirm = null
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun LocationRow(
    location: LocationItem,
    onSetDefault: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onEdit() },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(
                selected = location.isDefault,
                onClick = onSetDefault
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = location.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium
                )
                if (location.address.isNotEmpty()) {
                    Text(
                        text = location.address,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun LocationEditDialog(
    title: String,
    initialName: String,
    initialAddress: String,
    onDismiss: () -> Unit,
    onConfirm: (name: String, address: String) -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    var address by remember { mutableStateOf(initialAddress) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Location Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it },
                    label = { Text("Address") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name, address) },
                enabled = name.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

// ============================================================
// Section 4: Default Notifications
// ============================================================

/**
 * Default Notifications section: start-time and due-time notification rule lists
 * with offset dropdowns, add/remove rules.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DefaultNotificationsSection(
    notificationsJson: String,
    onNotificationsChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddStartDialog by remember { mutableStateOf(false) }
    var showAddDueDialog by remember { mutableStateOf(false) }

    val notifications = remember(notificationsJson) { parseNotificationsJson(notificationsJson) }

    Column {
        CollapsibleSectionHeader(
            title = "🔔 Default Notifications",
            expanded = expanded,
            onToggle = { expanded = !expanded }
        )

        AnimatedVisibility(visible = expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // Start Time Notifications
                Text(
                    text = "Start Time Notifications",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                if (notifications.startNotifications.isEmpty()) {
                    Text(
                        text = "No start time notification rules.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    notifications.startNotifications.forEachIndexed { index, rule ->
                        NotificationRuleRow(
                            rule = rule,
                            onDelete = {
                                val newStart = notifications.startNotifications.toMutableList()
                                newStart.removeAt(index)
                                val updated = notifications.copy(startNotifications = newStart)
                                onNotificationsChanged(serializeNotificationsJson(updated))
                            }
                        )
                    }
                }

                OutlinedButton(onClick = { showAddStartDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Start Rule")
                }

                HorizontalDivider()

                // Due Time Notifications
                Text(
                    text = "Due Time Notifications",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                if (notifications.dueNotifications.isEmpty()) {
                    Text(
                        text = "No due time notification rules.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    notifications.dueNotifications.forEachIndexed { index, rule ->
                        NotificationRuleRow(
                            rule = rule,
                            onDelete = {
                                val newDue = notifications.dueNotifications.toMutableList()
                                newDue.removeAt(index)
                                val updated = notifications.copy(dueNotifications = newDue)
                                onNotificationsChanged(serializeNotificationsJson(updated))
                            }
                        )
                    }
                }

                OutlinedButton(onClick = { showAddDueDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Due Rule")
                }
            }
        }
    }

    // Add Start Notification Dialog
    if (showAddStartDialog) {
        NotificationOffsetDialog(
            title = "Add Start Time Notification",
            existingOffsets = notifications.startNotifications.map { it.offsetMinutes },
            onDismiss = { showAddStartDialog = false },
            onConfirm = { rule ->
                val newStart = notifications.startNotifications + rule
                val updated = notifications.copy(startNotifications = newStart)
                onNotificationsChanged(serializeNotificationsJson(updated))
                showAddStartDialog = false
            }
        )
    }

    // Add Due Notification Dialog
    if (showAddDueDialog) {
        NotificationOffsetDialog(
            title = "Add Due Time Notification",
            existingOffsets = notifications.dueNotifications.map { it.offsetMinutes },
            onDismiss = { showAddDueDialog = false },
            onConfirm = { rule ->
                val newDue = notifications.dueNotifications + rule
                val updated = notifications.copy(dueNotifications = newDue)
                onNotificationsChanged(serializeNotificationsJson(updated))
                showAddDueDialog = false
            }
        )
    }
}

@Composable
private fun NotificationRuleRow(
    rule: NotificationRule,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = rule.label,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
            if (rule.afterTarget) {
                Text(
                    text = "⏩",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(end = 4.dp)
                )
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Remove rule",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationOffsetDialog(
    title: String,
    existingOffsets: List<Int>,
    onDismiss: () -> Unit,
    onConfirm: (NotificationRule) -> Unit
) {
    var valueText by remember { mutableStateOf("15") }
    var selectedUnit by remember { mutableStateOf("minutes") }
    var afterTarget by remember { mutableStateOf(false) }
    var unitExpanded by remember { mutableStateOf(false) }

    val unitOptions = listOf("minutes" to "min", "hours" to "hr", "days" to "day")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Value + Unit row
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = valueText,
                        onValueChange = { newVal ->
                            valueText = newVal.filter { it.isDigit() }.take(4)
                        },
                        label = { Text("Value") },
                        singleLine = true,
                        modifier = Modifier.width(80.dp),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        )
                    )

                    ExposedDropdownMenuBox(
                        expanded = unitExpanded,
                        onExpandedChange = { unitExpanded = !unitExpanded }
                    ) {
                        OutlinedTextField(
                            value = unitOptions.find { it.first == selectedUnit }?.second ?: "min",
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .menuAnchor()
                                .width(80.dp),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = unitExpanded) }
                        )
                        ExposedDropdownMenu(
                            expanded = unitExpanded,
                            onDismissRequest = { unitExpanded = false }
                        ) {
                            unitOptions.forEach { (value, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        selectedUnit = value
                                        unitExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                // Before/After toggle
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Direction:", style = MaterialTheme.typography.bodyMedium)
                    androidx.compose.material3.FilterChip(
                        selected = !afterTarget,
                        onClick = { afterTarget = false },
                        label = { Text("Before") }
                    )
                    androidx.compose.material3.FilterChip(
                        selected = afterTarget,
                        onClick = { afterTarget = true },
                        label = { Text("After") }
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val intValue = valueText.toIntOrNull() ?: 15
                    if (intValue > 0) {
                        onConfirm(NotificationRule(
                            value = intValue,
                            unit = selectedUnit,
                            afterTarget = afterTarget
                        ))
                    }
                },
                enabled = (valueText.toIntOrNull() ?: 0) > 0
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

// ============================================================
// Data Models
// ============================================================

private data class TagItem(
    val name: String,
    val color: String,
    val parent: String = "",
    val fontColor: String = "#5c3317",
    val favorite: Boolean = false,
    val shares: List<TagShare> = emptyList()
)

private data class TagShare(
    val userId: String,
    val role: String = "viewer",  // "viewer" or "manager"
    val displayName: String = ""
)

// Hierarchical tree node for display
private data class TagTreeNode(
    val name: String,        // Display name (last segment)
    val fullPath: String,    // Full path including parents
    val color: String?,
    val fontColor: String?,
    val favorite: Boolean,
    val children: MutableList<TagTreeNode> = mutableListOf(),
    val tagIndex: Int? = null // Index in the flat tags list, null for synthetic parents
)

private data class LocationItem(
    val name: String,
    val address: String,
    val lat: Double,
    val lon: Double,
    val isDefault: Boolean
)

private data class NotificationRule(
    val value: Int,
    val unit: String = "minutes",  // "minutes", "hours", "days"
    val afterTarget: Boolean = false
) {
    /** Human-readable label for display */
    val label: String
        get() {
            val direction = if (afterTarget) "after" else "before"
            val unitLabel = when {
                unit == "days" && value == 1 -> "day"
                unit == "hours" && value == 1 -> "hour"
                unit == "minutes" && value == 1 -> "minute"
                else -> unit
            }
            return "$value $unitLabel $direction"
        }

    /** Total offset in minutes (for comparison/dedup) */
    val offsetMinutes: Int
        get() = when (unit) {
            "hours" -> value * 60
            "days" -> value * 1440
            else -> value
        }
}

private data class NotificationsData(
    val startNotifications: List<NotificationRule>,
    val dueNotifications: List<NotificationRule>
)

// ============================================================
// Tag Tree Building
// ============================================================

/**
 * Build a hierarchical tag tree from a flat list of TagItems.
 * Tags with "/" in their name are split into parent-child relationships.
 * Favorites are sorted to the top at each level.
 * Requirement 15.1: Hierarchical tree structure with / delimiter.
 */
private fun buildTagTree(tags: List<TagItem>): List<TagTreeNode> {
    val root = mutableListOf<TagTreeNode>()
    val nodeMap = mutableMapOf<String, TagTreeNode>()

    tags.forEachIndexed { index, tag ->
        val parts = tag.name.split("/")
        var currentLevel = root
        var pathSoFar = ""

        parts.forEachIndexed { partIndex, part ->
            pathSoFar = if (pathSoFar.isEmpty()) part else "$pathSoFar/$part"
            val isLeaf = partIndex == parts.size - 1

            if (!nodeMap.containsKey(pathSoFar)) {
                val node = TagTreeNode(
                    name = part,
                    fullPath = pathSoFar,
                    color = if (isLeaf) tag.color else null,
                    fontColor = if (isLeaf) tag.fontColor else null,
                    favorite = if (isLeaf) tag.favorite else false,
                    tagIndex = if (isLeaf) index else null
                )
                nodeMap[pathSoFar] = node
                currentLevel.add(node)
            } else if (isLeaf) {
                // Update existing synthetic parent with actual tag data
                val existing = nodeMap[pathSoFar]!!
                val updated = TagTreeNode(
                    name = existing.name,
                    fullPath = existing.fullPath,
                    color = tag.color,
                    fontColor = tag.fontColor,
                    favorite = tag.favorite,
                    children = existing.children,
                    tagIndex = index
                )
                val parentList = if (partIndex == 0) root else {
                    val parentPath = pathSoFar.substringBeforeLast("/")
                    nodeMap[parentPath]?.children ?: root
                }
                val existingIndex = parentList.indexOf(existing)
                if (existingIndex >= 0) {
                    parentList[existingIndex] = updated
                }
                nodeMap[pathSoFar] = updated
            }
            currentLevel = nodeMap[pathSoFar]!!.children
        }
    }

    // Color inheritance: children with no color inherit from parent
    fun inheritColors(nodes: MutableList<TagTreeNode>, parentColor: String?) {
        for (i in nodes.indices) {
            val node = nodes[i]
            if (node.color == null && parentColor != null) {
                val updated = TagTreeNode(
                    name = node.name,
                    fullPath = node.fullPath,
                    color = parentColor,
                    fontColor = node.fontColor,
                    favorite = node.favorite,
                    children = node.children,
                    tagIndex = node.tagIndex
                )
                nodes[i] = updated
                nodeMap[node.fullPath] = updated
            }
            if (nodes[i].children.isNotEmpty()) {
                inheritColors(nodes[i].children, nodes[i].color ?: parentColor)
            }
        }
    }
    inheritColors(root, null)

    // Sort: favorites first, then alphabetically at every level
    fun sortLevel(nodes: MutableList<TagTreeNode>) {
        nodes.sortWith(compareBy<TagTreeNode> { !it.favorite }.thenBy { it.name.lowercase() })
        nodes.forEach { if (it.children.isNotEmpty()) sortLevel(it.children) }
    }
    sortLevel(root)

    return root
}

/**
 * Check if a hex color is "light" (for border visibility on light swatches).
 */
private fun isLightColor(hex: String): Boolean {
    return try {
        val clean = hex.removePrefix("#")
        if (clean.length < 6) return false
        val r = clean.substring(0, 2).toInt(16)
        val g = clean.substring(2, 4).toInt(16)
        val b = clean.substring(4, 6).toInt(16)
        // Perceived brightness formula
        (r * 299 + g * 587 + b * 114) / 1000 > 180
    } catch (e: Exception) {
        false
    }
}

// ============================================================
// JSON Parsing & Serialization
// ============================================================

private fun parseHexColor(hex: String): Color {
    return try {
        val cleanHex = hex.removePrefix("#")
        when (cleanHex.length) {
            3 -> {
                val r = cleanHex[0].toString().repeat(2).toInt(16)
                val g = cleanHex[1].toString().repeat(2).toInt(16)
                val b = cleanHex[2].toString().repeat(2).toInt(16)
                Color(r, g, b)
            }
            6 -> Color(
                cleanHex.substring(0, 2).toInt(16),
                cleanHex.substring(2, 4).toInt(16),
                cleanHex.substring(4, 6).toInt(16)
            )
            8 -> Color(
                cleanHex.substring(2, 4).toInt(16),
                cleanHex.substring(4, 6).toInt(16),
                cleanHex.substring(6, 8).toInt(16),
                cleanHex.substring(0, 2).toInt(16)
            )
            else -> Color.Gray
        }
    } catch (e: Exception) {
        Color.Gray
    }
}

private fun parseTagsJson(json: String): List<TagItem> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            val sharesArray = obj.optJSONArray("shares")
            val shares = if (sharesArray != null) {
                (0 until sharesArray.length()).map { j ->
                    val shareObj = sharesArray.getJSONObject(j)
                    TagShare(
                        userId = shareObj.optString("user_id", ""),
                        role = shareObj.optString("role", "viewer"),
                        displayName = shareObj.optString("display_name", "")
                    )
                }
            } else emptyList()
            TagItem(
                name = obj.optString("name", ""),
                color = obj.optString("color", "#808080"),
                parent = obj.optString("parent", ""),
                fontColor = obj.optString("fontColor", "#5c3317"),
                favorite = obj.optBoolean("favorite", false),
                shares = shares
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun serializeTagsJson(tags: List<TagItem>): String {
    val array = JSONArray()
    tags.forEach { tag ->
        val obj = JSONObject()
        obj.put("name", tag.name)
        obj.put("color", tag.color)
        if (tag.parent.isNotEmpty()) {
            obj.put("parent", tag.parent)
        }
        obj.put("fontColor", tag.fontColor)
        obj.put("favorite", tag.favorite)
        if (tag.shares.isNotEmpty()) {
            val sharesArray = JSONArray()
            tag.shares.forEach { share ->
                val shareObj = JSONObject()
                shareObj.put("user_id", share.userId)
                shareObj.put("role", share.role)
                shareObj.put("display_name", share.displayName)
                sharesArray.put(shareObj)
            }
            obj.put("shares", sharesArray)
        }
        array.put(obj)
    }
    return array.toString()
}

private fun parseColorsJson(json: String): List<String> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i -> array.getString(i) }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun serializeColorsJson(colors: List<String>): String {
    val array = JSONArray()
    colors.forEach { array.put(it) }
    return array.toString()
}

private fun parseLocationsJson(json: String): List<LocationItem> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            LocationItem(
                name = obj.optString("name", ""),
                address = obj.optString("address", ""),
                lat = obj.optDouble("lat", 0.0),
                lon = obj.optDouble("lon", 0.0),
                isDefault = obj.optBoolean("default", false)
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun serializeLocationsJson(locations: List<LocationItem>): String {
    val array = JSONArray()
    locations.forEach { loc ->
        val obj = JSONObject()
        obj.put("name", loc.name)
        obj.put("address", loc.address)
        obj.put("lat", loc.lat)
        obj.put("lon", loc.lon)
        obj.put("default", loc.isDefault)
        array.put(obj)
    }
    return array.toString()
}

private fun parseNotificationsJson(json: String): NotificationsData {
    return try {
        val obj = JSONObject(json)
        // Support both web format (start/due) and Android format (start_notifications/due_notifications)
        val startArray = obj.optJSONArray("start") ?: obj.optJSONArray("start_notifications") ?: JSONArray()
        val dueArray = obj.optJSONArray("due") ?: obj.optJSONArray("due_notifications") ?: JSONArray()

        val startRules = (0 until startArray.length()).map { i ->
            val ruleObj = startArray.getJSONObject(i)
            // Web format: {value, unit, afterTarget}
            // Android format: {label, offset_minutes}
            val value = ruleObj.optInt("value", 0)
            val unit = ruleObj.optString("unit", "minutes")
            val afterTarget = ruleObj.optBoolean("afterTarget", false)
            val offsetMinutes = ruleObj.optInt("offset_minutes", 0)

            if (value > 0) {
                // Web format — convert to unified
                NotificationRule(
                    value = value,
                    unit = unit,
                    afterTarget = afterTarget
                )
            } else if (offsetMinutes > 0) {
                // Legacy Android format — convert offset_minutes to value+unit
                val (convertedValue, convertedUnit) = offsetMinutesToValueUnit(offsetMinutes)
                NotificationRule(
                    value = convertedValue,
                    unit = convertedUnit,
                    afterTarget = false
                )
            } else {
                NotificationRule(value = 15, unit = "minutes", afterTarget = false)
            }
        }

        val dueRules = (0 until dueArray.length()).map { i ->
            val ruleObj = dueArray.getJSONObject(i)
            val value = ruleObj.optInt("value", 0)
            val unit = ruleObj.optString("unit", "minutes")
            val afterTarget = ruleObj.optBoolean("afterTarget", false)
            val offsetMinutes = ruleObj.optInt("offset_minutes", 0)

            if (value > 0) {
                NotificationRule(value = value, unit = unit, afterTarget = afterTarget)
            } else if (offsetMinutes > 0) {
                val (convertedValue, convertedUnit) = offsetMinutesToValueUnit(offsetMinutes)
                NotificationRule(value = convertedValue, unit = convertedUnit, afterTarget = false)
            } else {
                NotificationRule(value = 15, unit = "minutes", afterTarget = false)
            }
        }

        NotificationsData(startNotifications = startRules, dueNotifications = dueRules)
    } catch (e: Exception) {
        NotificationsData(startNotifications = emptyList(), dueNotifications = emptyList())
    }
}

/** Convert offset in minutes to the most natural value+unit pair */
private fun offsetMinutesToValueUnit(offsetMinutes: Int): Pair<Int, String> {
    return when {
        offsetMinutes >= 1440 && offsetMinutes % 1440 == 0 -> (offsetMinutes / 1440) to "days"
        offsetMinutes >= 60 && offsetMinutes % 60 == 0 -> (offsetMinutes / 60) to "hours"
        else -> offsetMinutes to "minutes"
    }
}

private fun serializeNotificationsJson(data: NotificationsData): String {
    val obj = JSONObject()

    // Use web format: {start: [...], due: [...]} with items {value, unit, afterTarget}
    val startArray = JSONArray()
    data.startNotifications.forEach { rule ->
        val ruleObj = JSONObject()
        ruleObj.put("value", rule.value)
        ruleObj.put("unit", rule.unit)
        ruleObj.put("afterTarget", rule.afterTarget)
        startArray.put(ruleObj)
    }

    val dueArray = JSONArray()
    data.dueNotifications.forEach { rule ->
        val ruleObj = JSONObject()
        ruleObj.put("value", rule.value)
        ruleObj.put("unit", rule.unit)
        ruleObj.put("afterTarget", rule.afterTarget)
        dueArray.put(ruleObj)
    }

    obj.put("start", startArray)
    obj.put("due", dueArray)
    return obj.toString()
}
