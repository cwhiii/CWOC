package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Header-level Clear and Defaults buttons for the Filters section.
 * Rendered via CollapsibleSection's headerExtra parameter.
 * "Clear" (✕): visible when any filter is non-default.
 * "Defaults" (↺): visible when the current tab has custom view defaults.
 */
@Composable
fun FilterHeaderButtons(
    showClear: Boolean,
    showDefaults: Boolean,
    onClear: () -> Unit,
    onDefaults: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier) {
        if (showClear) {
            OutlinedButton(
                onClick = onClear,
                border = BorderStroke(1.dp, FilterBrownBorder.copy(alpha = 0.4f)),
                shape = RoundedCornerShape(3.dp),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color.Transparent,
                    contentColor = FilterBrownBorder
                )
            ) {
                Text("✕ Clear", fontSize = 10.sp, color = FilterBrownBorder)
            }
        }

        if (showClear && showDefaults) {
            Spacer(modifier = Modifier.width(4.dp))
        }

        if (showDefaults) {
            OutlinedButton(
                onClick = onDefaults,
                border = BorderStroke(1.dp, FilterBrownBorder.copy(alpha = 0.4f)),
                shape = RoundedCornerShape(3.dp),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Color.Transparent,
                    contentColor = FilterBrownBorder
                )
            ) {
                Text("↺ Defaults", fontSize = 10.sp, color = FilterBrownBorder)
            }
        }
    }
}
