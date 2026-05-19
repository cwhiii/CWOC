package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A parchment-themed checkbox with label.
 * Unchecked: parchment fill (#fffaf0) + brown border (#6b4e31).
 * Checked: brown fill (#6b4e31) + parchment checkmark (#fffaf0).
 * Matches the web sidebar's checkbox styling.
 */
@Composable
fun ParchmentCheckbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .clickable(enabled = enabled) { onCheckedChange(!checked) }
            .padding(vertical = 2.dp)
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = null, // Handled by Row clickable to avoid double-fire
            enabled = enabled,
            colors = CheckboxDefaults.colors(
                checkedColor = FilterBrownBorder,
                uncheckedColor = FilterBrownBorder,
                checkmarkColor = FilterParchmentBg,
                disabledCheckedColor = FilterBrownBorder.copy(alpha = 0.5f),
                disabledUncheckedColor = FilterBrownBorder.copy(alpha = 0.5f)
            )
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            fontSize = 13.sp,
            color = if (enabled) FilterBrownText else FilterBrownText.copy(alpha = 0.5f)
        )
    }
}
