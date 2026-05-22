package com.cwoc.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Shared panel wrapper for secondary pages (Settings, Help, Trash, AuditLog, Weather,
 * ContactList, ContactEditor). Provides the parchment gradient background, brown border,
 * and rounded corners matching the web's `.settings-panel` styling.
 *
 * @param modifier Optional modifier for the outer Surface
 * @param content The page content to wrap inside the panel
 */
@Composable
fun CwocPagePanel(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(2.dp, Color(0xFF8B5A2B))
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFFFFF8E1), Color(0xFFF5E6CC))
                    )
                )
                .padding(16.dp)
        ) {
            content()
        }
    }
}
