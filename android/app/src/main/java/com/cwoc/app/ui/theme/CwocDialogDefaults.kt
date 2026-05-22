package com.cwoc.app.ui.theme

import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Shared defaults for dialogs, bottom sheets, and dropdown menus.
 * Ensures all popover UI uses the parchment theme consistently.
 */
object CwocDialogDefaults {

    val containerColor = CwocDialogBg

    val borderModifier = Modifier.border(1.dp, CwocOutline, RoundedCornerShape(10.dp))

    val titleStyle = TextStyle(
        fontFamily = LoraFontFamily,
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF1A1208)
    )

    @Composable
    fun confirmButtonColors(): ButtonColors = ButtonColors(
        containerColor = CwocButtonTan,
        contentColor = CwocAgedBrownDark,
        disabledContainerColor = CwocButtonTan.copy(alpha = 0.5f),
        disabledContentColor = CwocAgedBrownDark.copy(alpha = 0.5f)
    )

    @Composable
    fun dangerButtonColors(): ButtonColors = ButtonColors(
        containerColor = CwocError,
        contentColor = CwocOnError,
        disabledContainerColor = CwocError.copy(alpha = 0.5f),
        disabledContentColor = CwocOnError.copy(alpha = 0.5f)
    )
}
