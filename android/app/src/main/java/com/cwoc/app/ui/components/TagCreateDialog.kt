package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.tags.TagNode
import com.cwoc.app.ui.theme.ColorUtils
import com.cwoc.app.ui.theme.CwocDialogDefaults
import androidx.compose.material3.Button
import com.cwoc.app.ui.theme.CwocInputDefaults

/**
 * Data class for passing existing tag data to the edit dialog.
 */
data class TagEditData(
    val name: String,
    val color: String? = null,
    val fontColor: String? = null,
    val favorite: Boolean = false,
    val parentPath: String? = null
)

/**
 * Color palette for tag creation — uses the unified CwocDefaultColors palette.
 */
private val TAG_COLOR_PALETTE: List<String?> = listOf(null) + ColorUtils.CwocDefaultColorHexes

/**
 * Dialog for creating or editing a tag with name, color, font color, favorite, and optional parent tag.
 * Matches the web's cwocTagModal behavior.
 *
 * Accessible from:
 * - Editor Tags zone → "Create Tag" button at bottom of tag picker sheet
 * - Settings Collections tab → Tag Editor
 * - Long-press on a tag chip → Edit mode
 *
 * @param parentTags List of available parent tag names for the dropdown
 * @param editingTag If non-null, the tag being edited (enables edit mode with rename/delete)
 * @param onConfirm Callback with (name, color, fontColor, parentPath, favorite) when tag is saved
 * @param onDelete Callback when tag is deleted (edit mode only)
 * @param onDismiss Callback when dialog is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TagCreateDialog(
    parentTags: List<TagNode> = emptyList(),
    editingTag: TagEditData? = null,
    onConfirm: (name: String, color: String?, fontColor: String?, parentPath: String?, favorite: Boolean) -> Unit = { _, _, _, _, _ -> },
    onDelete: ((String) -> Unit)? = null,
    onDismiss: () -> Unit
) {
    var tagName by remember { mutableStateOf(editingTag?.name ?: "") }
    var selectedColor by remember { mutableStateOf<String?>(editingTag?.color) }
    var selectedFontColor by remember { mutableStateOf<String?>(editingTag?.fontColor ?: "#5c3317") }
    var isFavorite by remember { mutableStateOf(editingTag?.favorite ?: false) }
    var selectedParent by remember { mutableStateOf<String?>(editingTag?.parentPath) }
    var parentExpanded by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    val isEditMode = editingTag != null

    // Flatten parent tags for dropdown
    val flatParentTags = remember(parentTags) {
        val flat = mutableListOf<Pair<String, String>>() // (fullPath, displayName)
        fun walk(nodes: List<TagNode>, depth: Int) {
            nodes.forEach { node ->
                val indent = "  ".repeat(depth)
                flat.add(node.fullPath to "$indent${node.name}")
                walk(node.children, depth + 1)
            }
        }
        walk(parentTags, 0)
        flat
    }

    // Delete confirmation
    if (showDeleteConfirm && editingTag != null) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            modifier = CwocDialogDefaults.borderModifier,
            containerColor = CwocDialogDefaults.containerColor,
            title = { Text("Delete Tag", style = CwocDialogDefaults.titleStyle) },
            text = { Text("Delete \"${editingTag.name}\"? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    onDelete?.invoke(editingTag.name)
                }, colors = CwocDialogDefaults.dangerButtonColors()) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Cancel") }
            }
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = CwocDialogDefaults.borderModifier,
        title = { Text(if (isEditMode) "Edit Tag" else "Create Tag", style = CwocDialogDefaults.titleStyle) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Favorite toggle + Name field row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Favorite star toggle
                    Text(
                        text = if (isFavorite) "★" else "☆",
                        style = MaterialTheme.typography.headlineSmall,
                        color = if (isFavorite) androidx.compose.ui.graphics.Color(0xFFD4AF37) else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .clickable { isFavorite = !isFavorite }
                            .padding(end = 8.dp)
                    )

                    // Name field
                    OutlinedTextField(
                        value = tagName,
                        onValueChange = { tagName = it },
                        label = { Text("Tag Name") },
                        placeholder = { Text("Enter tag name") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = CwocInputDefaults.outlinedColors()
                    )
                }

                // Background Color picker (swatches)
                Text(
                    text = "Background Color",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TAG_COLOR_PALETTE.forEach { colorHex ->
                        val isSelected = selectedColor == colorHex
                        val swatchColor = if (colorHex != null) {
                            parseTagColorHex(colorHex)
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant
                        }
                        val borderColor = if (isSelected) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.outlineVariant
                        }

                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(swatchColor)
                                .border(
                                    width = if (isSelected) 2.dp else 1.dp,
                                    color = borderColor,
                                    shape = CircleShape
                                )
                                .clickable { selectedColor = colorHex },
                            contentAlignment = Alignment.Center
                        ) {
                            if (isSelected) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = "Selected",
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            if (colorHex == null) {
                                Text(
                                    text = "☒",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                // Live preview chip
                val previewBg = selectedColor?.let { parseTagColorHex(it) } ?: MaterialTheme.colorScheme.surfaceVariant
                val previewFg = selectedFontColor?.let { parseTagColorHex(it) } ?: Color(0xFF5C3317)
                Box(
                    modifier = Modifier
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(10.dp))
                        .background(previewBg)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = tagName.ifBlank { "Preview" },
                        style = MaterialTheme.typography.labelMedium,
                        color = previewFg
                    )
                }

                // Optional parent tag dropdown
                if (flatParentTags.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(4.dp))

                    ExposedDropdownMenuBox(
                        expanded = parentExpanded,
                        onExpandedChange = { parentExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = selectedParent ?: "(No parent)",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Parent Tag (optional)") },
                            trailingIcon = {
                                ExposedDropdownMenuDefaults.TrailingIcon(expanded = parentExpanded)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            singleLine = true,
                            colors = CwocInputDefaults.outlinedColors()
                        )
                        ExposedDropdownMenu(
                            expanded = parentExpanded,
                            onDismissRequest = { parentExpanded = false }
                        ) {
                            // No parent option
                            DropdownMenuItem(
                                text = { Text("(No parent)") },
                                onClick = {
                                    selectedParent = null
                                    parentExpanded = false
                                }
                            )
                            flatParentTags.forEach { (fullPath, displayName) ->
                                DropdownMenuItem(
                                    text = { Text(displayName) },
                                    onClick = {
                                        selectedParent = fullPath
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
            androidx.compose.foundation.layout.Column {
                TextButton(
                    onClick = { onConfirm(tagName.trim(), selectedColor, selectedFontColor, selectedParent, isFavorite) },
                    enabled = tagName.isNotBlank(), colors = CwocDialogDefaults.confirmButtonColors()) {
                    Text(if (isEditMode) "Save" else "Create")
                }
                // Delete button (edit mode only)
                if (isEditMode && onDelete != null) {
                    TextButton(
                        onClick = { showDeleteConfirm = true }, colors = CwocDialogDefaults.dangerButtonColors()) {
                        Text("🗑️ Delete")
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
        containerColor = CwocDialogDefaults.containerColor
    )
}

/**
 * Parses a hex color string into a Compose Color for the tag color picker.
 */
private fun parseTagColorHex(hex: String): Color {
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
