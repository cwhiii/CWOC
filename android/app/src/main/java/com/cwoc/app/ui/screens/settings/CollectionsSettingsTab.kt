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
            onColorsChanged = { onUpdateSetting("custom_colors", it) }
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
                    tags.forEachIndexed { index, tag ->
                        TagRow(
                            tag = tag,
                            childCount = tags.count { it.parent == tag.name },
                            onEdit = { editingTagIndex = index },
                            onDelete = { showDeleteConfirm = index }
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
        TagEditDialog(
            title = "Add Tag",
            initialName = "",
            initialColor = DEFAULT_COLORS.first(),
            initialParent = "",
            availableParents = tags.map { it.name },
            onDismiss = { showAddDialog = false },
            onConfirm = { name, color, parent ->
                val newTags = tags + TagItem(name = name, color = color, parent = parent)
                onTagsChanged(serializeTagsJson(newTags))
                showAddDialog = false
            }
        )
    }

    // Edit Tag Dialog
    editingTagIndex?.let { index ->
        val tag = tags[index]
        TagEditDialog(
            title = "Edit Tag",
            initialName = tag.name,
            initialColor = tag.color,
            initialParent = tag.parent,
            availableParents = tags.filter { it.name != tag.name }.map { it.name },
            onDismiss = { editingTagIndex = null },
            onConfirm = { name, color, parent ->
                val newTags = tags.toMutableList()
                newTags[index] = TagItem(name = name, color = color, parent = parent)
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

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TagRow(
    tag: TagItem,
    childCount: Int,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onEdit,
                onLongClick = onDelete
            ),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Color swatch
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(parseHexColor(tag.color))
            )
            Spacer(modifier = Modifier.width(12.dp))
            // Tag name
            Text(
                text = tag.name,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f)
            )
            // Child count
            if (childCount > 0) {
                Text(
                    text = "$childCount children",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            // Parent indicator
            if (tag.parent.isNotEmpty()) {
                Text(
                    text = "↳ ${tag.parent}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun TagEditDialog(
    title: String,
    initialName: String,
    initialColor: String,
    initialParent: String,
    availableParents: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (name: String, color: String, parent: String) -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    var selectedColor by remember { mutableStateOf(initialColor) }
    var selectedParent by remember { mutableStateOf(initialParent) }
    var parentExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Tag Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Color", style = MaterialTheme.typography.labelMedium)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DEFAULT_COLORS.forEach { color ->
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(parseHexColor(color))
                                .then(
                                    if (color == selectedColor) {
                                        Modifier.border(3.dp, MaterialTheme.colorScheme.primary, CircleShape)
                                    } else {
                                        Modifier.border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                                    }
                                )
                                .clickable { selectedColor = color }
                        )
                    }
                }

                // Parent dropdown (optional)
                if (availableParents.isNotEmpty()) {
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
                onClick = { onConfirm(name, selectedColor, selectedParent) },
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
// Section 2: Custom Colors
// ============================================================

/**
 * Custom Colors section: shows default palette + user-defined colors,
 * supports add (hex input), edit, and delete.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CustomColorsSection(
    customColorsJson: String,
    onColorsChanged: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingColorIndex by remember { mutableStateOf<Int?>(null) }

    val customColors = remember(customColorsJson) { parseColorsJson(customColorsJson) }

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
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(parseHexColor(color))
                                .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
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
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(parseHexColor(color))
                                    .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                                    .clickable { editingColorIndex = index }
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
            onConfirm = { offset ->
                val newRule = NotificationRule(
                    label = NOTIFICATION_OFFSETS.find { it.second == offset }?.first ?: "$offset minutes before",
                    offsetMinutes = offset
                )
                val newStart = notifications.startNotifications + newRule
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
            onConfirm = { offset ->
                val newRule = NotificationRule(
                    label = NOTIFICATION_OFFSETS.find { it.second == offset }?.first ?: "$offset minutes before",
                    offsetMinutes = offset
                )
                val newDue = notifications.dueNotifications + newRule
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
    onConfirm: (offsetMinutes: Int) -> Unit
) {
    var selectedOffset by remember { mutableStateOf<Int?>(null) }
    var dropdownExpanded by remember { mutableStateOf(false) }

    // Filter out already-used offsets
    val availableOffsets = NOTIFICATION_OFFSETS.filter { it.second !in existingOffsets }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                if (availableOffsets.isEmpty()) {
                    Text("All notification offsets are already in use.")
                } else {
                    ExposedDropdownMenuBox(
                        expanded = dropdownExpanded,
                        onExpandedChange = { dropdownExpanded = !dropdownExpanded }
                    ) {
                        OutlinedTextField(
                            value = selectedOffset?.let { offset ->
                                NOTIFICATION_OFFSETS.find { it.second == offset }?.first ?: ""
                            } ?: "Select offset...",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = dropdownExpanded,
                            onDismissRequest = { dropdownExpanded = false }
                        ) {
                            availableOffsets.forEach { (label, offset) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        selectedOffset = offset
                                        dropdownExpanded = false
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
                onClick = { selectedOffset?.let { onConfirm(it) } },
                enabled = selectedOffset != null
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
    val parent: String = ""
)

private data class LocationItem(
    val name: String,
    val address: String,
    val lat: Double,
    val lon: Double,
    val isDefault: Boolean
)

private data class NotificationRule(
    val label: String,
    val offsetMinutes: Int
)

private data class NotificationsData(
    val startNotifications: List<NotificationRule>,
    val dueNotifications: List<NotificationRule>
)

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
            TagItem(
                name = obj.optString("name", ""),
                color = obj.optString("color", "#808080"),
                parent = obj.optString("parent", "")
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
        val startArray = obj.optJSONArray("start_notifications") ?: JSONArray()
        val dueArray = obj.optJSONArray("due_notifications") ?: JSONArray()

        val startRules = (0 until startArray.length()).map { i ->
            val ruleObj = startArray.getJSONObject(i)
            val offset = ruleObj.optInt("offset_minutes", 15)
            NotificationRule(
                label = ruleObj.optString("label",
                    NOTIFICATION_OFFSETS.find { it.second == offset }?.first ?: "$offset minutes before"
                ),
                offsetMinutes = offset
            )
        }

        val dueRules = (0 until dueArray.length()).map { i ->
            val ruleObj = dueArray.getJSONObject(i)
            val offset = ruleObj.optInt("offset_minutes", 15)
            NotificationRule(
                label = ruleObj.optString("label",
                    NOTIFICATION_OFFSETS.find { it.second == offset }?.first ?: "$offset minutes before"
                ),
                offsetMinutes = offset
            )
        }

        NotificationsData(startNotifications = startRules, dueNotifications = dueRules)
    } catch (e: Exception) {
        NotificationsData(startNotifications = emptyList(), dueNotifications = emptyList())
    }
}

private fun serializeNotificationsJson(data: NotificationsData): String {
    val obj = JSONObject()

    val startArray = JSONArray()
    data.startNotifications.forEach { rule ->
        val ruleObj = JSONObject()
        ruleObj.put("label", rule.label)
        ruleObj.put("offset_minutes", rule.offsetMinutes)
        startArray.put(ruleObj)
    }

    val dueArray = JSONArray()
    data.dueNotifications.forEach { rule ->
        val ruleObj = JSONObject()
        ruleObj.put("label", rule.label)
        ruleObj.put("offset_minutes", rule.offsetMinutes)
        dueArray.put(ruleObj)
    }

    obj.put("start_notifications", startArray)
    obj.put("due_notifications", dueArray)
    return obj.toString()
}
