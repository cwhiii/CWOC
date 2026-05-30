package com.cwoc.app.ui.screens.email

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.remote.BundleDto
import com.cwoc.app.ui.theme.ColorUtils
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocInputDefaults

// ─── Color Palette ──────────────────────────────────────────────────────────────

/**
 * Predefined color swatches for bundle tab colors.
 * Uses the unified CwocDefaultColors palette with a null entry for "None".
 */
private val BUNDLE_COLOR_PALETTE: List<String?> = listOf(null) + ColorUtils.CwocDefaultColorHexes

// ─── Create Bundle Modal ────────────────────────────────────────────────────────

/**
 * Modal dialog for creating a new bundle.
 *
 * Fields:
 * - Name (required TextField)
 * - Description (optional multiline TextField)
 * - Tab Color (color picker with swatches + "None" option)
 * - Show in Omni View (Checkbox)
 *
 * Buttons: Cancel (dismiss), Define Rule (save + navigate to rule editor)
 *
 * Validates: Requirements 24.1-24.7
 *
 * @param onDismiss Called when the user cancels or taps outside the dialog
 * @param onDefineRule Called with (name, description, color, showInOmni) when the user
 *        taps "Define Rule" — the caller should save the bundle and navigate to the rule editor
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CreateBundleModal(
    onDismiss: () -> Unit,
    onDefineRule: (name: String, description: String?, color: String?, showInOmni: Boolean) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedColor by remember { mutableStateOf<String?>(null) }
    var showInOmniView by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = CwocDialogDefaults.borderModifier,
        title = {
            Text(
                text = "Create Bundle",
                style = CwocDialogDefaults.titleStyle,
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Name field (required)
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name *") },
                    placeholder = { Text("Bundle name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Description field (optional, multiline)
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    placeholder = { Text("Optional description") },
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Tab Color picker
                Text(
                    text = "Tab Color",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                ColorSwatchPicker(
                    selectedColor = selectedColor,
                    onColorSelected = { selectedColor = it }
                )

                // Show in Omni View checkbox
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showInOmniView = !showInOmniView },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = showInOmniView,
                        onCheckedChange = { showInOmniView = it }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Show in Omni View",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onDefineRule(
                        name.trim(),
                        description.trim().ifBlank { null },
                        selectedColor,
                        showInOmniView
                    )
                },
                enabled = name.isNotBlank(), colors = CwocDialogDefaults.confirmButtonColors()) {
                Text("Define Rule")
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

// ─── Edit Bundle Modal ──────────────────────────────────────────────────────────

/**
 * Modal dialog for editing an existing bundle.
 *
 * Fields (pre-populated with current bundle values):
 * - Name (required TextField)
 * - Description (optional multiline TextField)
 * - Tab Color (color picker with swatches + "None" option)
 * - Show in Omni View (Checkbox)
 *
 * Additional buttons: Change Rules (navigate to rule editor), Delete (with confirmation)
 * Buttons: Cancel (dismiss), Save (update bundle)
 *
 * Validates: Requirements 25.1-25.6
 *
 * @param bundle The bundle being edited, pre-populated into form fields
 * @param onDismiss Called when the user cancels or taps outside the dialog
 * @param onSave Called with (name, description, color, showInOmni) when the user taps "Save"
 * @param onChangeRules Called when the user taps "Change Rules" — navigate to rule editor
 * @param onDelete Called when the user confirms deletion of the bundle
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EditBundleModal(
    bundle: BundleDto,
    onDismiss: () -> Unit,
    onSave: (name: String, description: String?, color: String?, showInOmni: Boolean) -> Unit,
    onChangeRules: () -> Unit,
    onDelete: () -> Unit
) {
    var name by remember { mutableStateOf(bundle.name ?: "") }
    var description by remember { mutableStateOf("") }
    var selectedColor by remember { mutableStateOf(bundle.color) }
    var showInOmniView by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            modifier = CwocDialogDefaults.borderModifier,
            title = {
                Text(
                    text = "Delete Bundle",
                    color = MaterialTheme.colorScheme.error,
                    style = CwocDialogDefaults.titleStyle,
                )
            },
            text = {
                Text("Are you sure you want to delete \"${bundle.name ?: "this bundle"}\"? This action cannot be undone.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        onDelete()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            },
            containerColor = CwocDialogDefaults.containerColor
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = CwocDialogDefaults.borderModifier,
        title = {
            Text(
                text = "Edit Bundle",
                style = CwocDialogDefaults.titleStyle,
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Name field (required)
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name *") },
                    placeholder = { Text("Bundle name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Description field (optional, multiline)
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    placeholder = { Text("Optional description") },
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                    colors = CwocInputDefaults.outlinedColors()
                )

                // Tab Color picker
                Text(
                    text = "Tab Color",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                ColorSwatchPicker(
                    selectedColor = selectedColor,
                    onColorSelected = { selectedColor = it }
                )

                // Show in Omni View checkbox
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showInOmniView = !showInOmniView },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = showInOmniView,
                        onCheckedChange = { showInOmniView = it }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Show in Omni View",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Change Rules button
                TextButton(
                    onClick = onChangeRules,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Change Rules")
                }

                // Delete button
                // Delete button — only show for removable bundles
                if (bundle.removable != false) {
                    TextButton(
                        onClick = { showDeleteConfirm = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.textButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Delete",
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Delete Bundle")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        name.trim(),
                        description.trim().ifBlank { null },
                        selectedColor,
                        showInOmniView
                    )
                },
                enabled = name.isNotBlank(), colors = CwocDialogDefaults.confirmButtonColors()) {
                Text("Save")
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

// ─── Color Swatch Picker ────────────────────────────────────────────────────────

/**
 * A row of colored circles for selecting a bundle tab color.
 * Includes a "None" option (first swatch, shown as a neutral circle with ☒).
 *
 * @param selectedColor The currently selected color hex string (null = None)
 * @param onColorSelected Called with the selected color hex (or null for None)
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColorSwatchPicker(
    selectedColor: String?,
    onColorSelected: (String?) -> Unit
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        BUNDLE_COLOR_PALETTE.forEach { colorHex ->
            val isSelected = selectedColor == colorHex
            val swatchColor = if (colorHex != null) {
                parseColorHex(colorHex)
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
                    .clickable { onColorSelected(colorHex) },
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
                if (colorHex == null && !isSelected) {
                    Text(
                        text = "☒",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

// ─── Utility ────────────────────────────────────────────────────────────────────

/**
 * Parses a hex color string (e.g., "#C66B6B") into a Compose Color.
 */
private fun parseColorHex(hex: String): Color {
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
