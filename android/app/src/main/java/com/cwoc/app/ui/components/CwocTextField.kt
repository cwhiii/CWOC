package com.cwoc.app.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown

/**
 * Returns CWOC-themed TextFieldColors for OutlinedTextField.
 * Matches the web's input field styling:
 * - Parchment background (surface color)
 * - Brown border (#6b4e31)
 * - Dark text (#1a1208)
 * - Brown focused border (slightly darker)
 *
 * Usage:
 *   OutlinedTextField(
 *       value = ...,
 *       onValueChange = ...,
 *       colors = cwocTextFieldColors()
 *   )
 */
@Composable
fun cwocTextFieldColors(): TextFieldColors {
    return OutlinedTextFieldDefaults.colors(
        // Container (background)
        focusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        disabledContainerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
        // Border
        focusedBorderColor = CwocZoneHeaderBrown,
        unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
        disabledBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
        // Text
        focusedTextColor = MaterialTheme.colorScheme.onSurface,
        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
        // Label
        focusedLabelColor = CwocZoneHeaderBrown,
        unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
        // Cursor
        cursorColor = CwocZoneHeaderBrown
    )
}
