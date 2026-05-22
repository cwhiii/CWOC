package com.cwoc.app.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

/**
 * Shared button styling defaults for the CWOC parchment theme.
 * Provides outset (raised/embossed) and danger button configurations.
 */
object CwocButtonDefaults {

    @Composable
    fun outsetColors(): ButtonColors = ButtonColors(
        containerColor = CwocButtonTan,
        contentColor = CwocAgedBrownDark,
        disabledContainerColor = CwocButtonTan.copy(alpha = 0.5f),
        disabledContentColor = CwocAgedBrownDark.copy(alpha = 0.5f)
    )

    val outsetBorder = BorderStroke(2.dp, CwocOutsetBorder)

    val outsetShape = RoundedCornerShape(4.dp)

    @Composable
    fun dangerColors(): ButtonColors = ButtonColors(
        containerColor = CwocError,
        contentColor = CwocOnError,
        disabledContainerColor = CwocError.copy(alpha = 0.5f),
        disabledContentColor = CwocOnError.copy(alpha = 0.5f)
    )

    val dangerBorder = BorderStroke(2.dp, CwocAgedBrownDark)
}
