package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import com.cwoc.app.ui.theme.ColorUtils
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
 * Default color palette — uses the unified CwocDefaultColors from ColorUtils.
 * Contains "transparent" as the first option (editor-specific) plus all shared defaults.
 */
val DEFAULT_COLOR_PALETTE = listOf("transparent") + ColorUtils.CwocDefaultColorHexes

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
 * Uses the unified ColorUtils.colorName() lookup.
 */
private fun getColorName(hex: String): String {
    return ColorUtils.colorName(hex)
}
