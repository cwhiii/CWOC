package com.cwoc.app.ui.screens.editor.zones

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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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

/**
 * Default color palette matching the web app's color picker.
 * Contains the full 20-color palette used in both the chit editor and contact editor.
 */
val DEFAULT_COLOR_PALETTE = listOf(
    "transparent", // No color (☒ icon)
    "#E3B23C", // Golden Ochre
    "#D4764E", // Burnt Orange
    "#D45B5B", // Coral Red
    "#C2185B", // Deep Pink
    "#7B1FA2", // Deep Purple
    "#512DA8", // Indigo
    "#303F9F", // Dark Blue
    "#1976D2", // Medium Blue
    "#0097A7", // Teal
    "#00897B", // Dark Teal
    "#388E3C", // Forest Green
    "#689F38", // Olive Green
    "#AFB42B", // Lime
    "#F9A825", // Amber
    "#FF8F00", // Dark Amber
    "#D84315", // Deep Orange
    "#795548", // Brown
    "#546E7A", // Blue Grey
    "#8D6E63", // Warm Brown
    "#E91E63"  // Pink
)

/**
 * ColorZone composable for the chit editor.
 *
 * Provides a collapsible zone with:
 * - Grid of color swatches from [DEFAULT_COLOR_PALETTE]
 * - Additional row for custom colors from user settings
 * - Selected color shows a checkmark overlay
 * - "Clear" chip to remove the color selection
 * - Color indicator in the zone header trailing content when a color is selected
 * - Immediate visual update on selection
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 *
 * @param selectedColor The currently selected color hex string (nullable, null means no color)
 * @param customColors List of custom color hex strings from user settings
 * @param onColorSelected Callback when a color is selected or cleared (null = cleared)
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ColorZone(
    selectedColor: String?,
    customColors: List<String>,
    onColorSelected: (String?) -> Unit
) {
    var isExpanded by remember { mutableStateOf(false) }

    EditorZoneHeader(
        title = "Color",
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            // Show a small color indicator circle and name when a color is selected (gap 21/29)
            if (selectedColor != null) {
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(parseHexColor(selectedColor))
                        .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                )
                Text(
                    text = getColorName(selectedColor),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // --- Default Palette Grid ---
            Text(
                text = "Default Colors",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                DEFAULT_COLOR_PALETTE.forEach { colorHex ->
                    ColorSwatch(
                        colorHex = colorHex,
                        isSelected = selectedColor.equals(colorHex, ignoreCase = true),
                        onClick = { onColorSelected(colorHex) }
                    )
                }
            }

            // --- Custom Colors Row (only shown if user has custom colors) ---
            if (customColors.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Custom Colors",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    customColors.forEach { colorHex ->
                        ColorSwatch(
                            colorHex = colorHex,
                            isSelected = selectedColor.equals(colorHex, ignoreCase = true),
                            onClick = { onColorSelected(colorHex) }
                        )
                    }
                }
            }

            // --- Clear Button ---
            Spacer(modifier = Modifier.height(4.dp))
            AssistChip(
                onClick = { onColorSelected(null) },
                label = { Text("Clear") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )
        }
    }
}

// ─── Color Swatch ───────────────────────────────────────────────────────────────

/**
 * A single color swatch circle. Shows a checkmark overlay when selected.
 *
 * @param colorHex Hex color string (e.g., "#FF6B6B")
 * @param isSelected Whether this swatch is the currently selected color
 * @param onClick Callback when the swatch is tapped
 */
@Composable
private fun ColorSwatch(
    colorHex: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val color = parseHexColor(colorHex)
    val borderColor = if (isSelected) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.outlineVariant
    }
    val borderWidth = if (isSelected) 2.dp else 1.dp

    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(color)
            .border(borderWidth, borderColor, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        // Checkmark overlay for selected color
        if (isSelected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Selected",
                tint = Color.White,
                modifier = Modifier
                    .size(20.dp)
                    .padding(2.dp)
            )
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Parses a hex color string (e.g., "#FF6B6B") into a Compose [Color].
 * Falls back to [Color.Gray] if parsing fails.
 */
internal fun parseHexColor(hex: String): Color {
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
 * Returns a human-readable name for a hex color.
 * Maps known palette colors to names, falls back to the hex value.
 */
private fun getColorName(hex: String): String {
    val colorNames = mapOf(
        "#E3B23C" to "Golden Ochre",
        "#D4764E" to "Burnt Orange",
        "#D45B5B" to "Coral Red",
        "#C2185B" to "Deep Pink",
        "#7B1FA2" to "Deep Purple",
        "#512DA8" to "Indigo",
        "#303F9F" to "Dark Blue",
        "#1976D2" to "Medium Blue",
        "#0097A7" to "Teal",
        "#00897B" to "Dark Teal",
        "#388E3C" to "Forest Green",
        "#689F38" to "Olive Green",
        "#AFB42B" to "Lime",
        "#F9A825" to "Amber",
        "#FF8F00" to "Dark Amber",
        "#D84315" to "Deep Orange",
        "#795548" to "Brown",
        "#546E7A" to "Blue Grey",
        "#8D6E63" to "Warm Brown",
        "#E91E63" to "Pink",
        "#C66B6B" to "Dusty Rose",
        "#D68A59" to "Burnt Sienna",
        "#8A9A5B" to "Mossy Sage",
        "#6B8299" to "Slate Teal",
        "#8B6B99" to "Muted Lilac"
    )
    return colorNames[hex.uppercase()] ?: colorNames[hex] ?: hex
}
