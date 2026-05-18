package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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

/**
 * Color palette for tag creation — matches the ColorZone default palette.
 */
private val TAG_COLOR_PALETTE = listOf(
    null,          // No color
    "#C66B6B",     // Muted Red
    "#D68A59",     // Muted Orange
    "#E3B23C",     // Muted Yellow/Gold
    "#8A9A5B",     // Muted Green
    "#6B8299",     // Muted Blue
    "#8B6B99",     // Muted Purple
    "#B85C5C",     // Darker Red
    "#C47A3F",     // Darker Orange
    "#7A8A4B",     // Darker Green
    "#5B7289",     // Darker Blue
    "#7B5B89",     // Darker Purple
    "#996B4E"      // Brown
)

/**
 * Dialog for creating a new tag with name, color, and optional parent tag.
 *
 * Accessible from:
 * - Editor Tags zone → "Create Tag" button at bottom of tag picker sheet
 * - Settings Collections tab → Tag Editor
 *
 * On save: adds to shared_tags in settings and syncs.
 *
 * @param parentTags List of available parent tag names for the dropdown
 * @param onConfirm Callback with (name, color, parentPath) when tag is created
 * @param onDismiss Callback when dialog is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TagCreateDialog(
    parentTags: List<TagNode> = emptyList(),
    onConfirm: (name: String, color: String?, parentPath: String?) -> Unit,
    onDismiss: () -> Unit
) {
    var tagName by remember { mutableStateOf("") }
    var selectedColor by remember { mutableStateOf<String?>(null) }
    var selectedParent by remember { mutableStateOf<String?>(null) }
    var parentExpanded by remember { mutableStateOf(false) }

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

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Tag") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Name field
                OutlinedTextField(
                    value = tagName,
                    onValueChange = { tagName = it },
                    label = { Text("Tag Name") },
                    placeholder = { Text("Enter tag name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Color picker (swatches)
                Text(
                    text = "Color",
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
                            singleLine = true
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
            TextButton(
                onClick = { onConfirm(tagName.trim(), selectedColor, selectedParent) },
                enabled = tagName.isNotBlank()
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
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
