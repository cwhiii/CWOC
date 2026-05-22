package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Shared section heading composable for secondary pages (Settings, Help, Trash,
 * AuditLog, Weather, etc.). Renders uppercase text with letter spacing and a
 * brown bottom border, matching the web's `h2, h3 { text-transform: uppercase;
 * letter-spacing: 2px; border-bottom: 1px solid #8b5a2b; padding-bottom: 10px }`.
 *
 * @param text The heading text (will be uppercased automatically)
 * @param modifier Optional modifier for the outer Column
 */
@Composable
fun CwocSectionHeading(
    text: String,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.padding(bottom = 10.dp)) {
        Text(
            text = text.uppercase(),
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF1A1208),
            letterSpacing = 2.sp
        )
        HorizontalDivider(
            color = Color(0xFF8B5A2B),
            thickness = 1.dp
        )
    }
}
