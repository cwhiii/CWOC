package com.cwoc.app.ui.navigation.filter

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A small "Clear" button matching the web's filter-clear-btn style.
 * 1dp brown border at 30% opacity, 3dp corners, transparent background.
 */
@Composable
fun FilterClearButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    text: String = "Clear"
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        border = BorderStroke(1.dp, FilterBrownBorder.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(3.dp),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 3.dp),
        colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
            containerColor = Color.Transparent,
            contentColor = FilterBrownBorder
        )
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            color = FilterBrownBorder
        )
    }
}
