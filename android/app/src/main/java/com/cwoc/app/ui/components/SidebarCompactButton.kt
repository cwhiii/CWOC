package com.cwoc.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Half-width compact button for the sidebar quick-access section.
 * Matches the web's `.sidebar-compact-btn` styling:
 * - Brown background (#8B5A2B), parchment text (#FFF8E1)
 * - 1dp border (#5A3F2A)
 * - Compact padding, smaller text (~12sp)
 * - Use with Modifier.weight(1f) in a Row to fill half width
 *
 * @param text Button label text
 * @param onClick Action when tapped
 * @param modifier Modifier (use .weight(1f) in a Row for half-width)
 */
@Composable
fun SidebarCompactButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(38.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF8B5A2B),
            contentColor = Color(0xFFFFF8E1)
        ),
        border = BorderStroke(1.dp, Color(0xFF5A3F2A)),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(4.dp)
    ) {
        Text(
            text = text,
            fontSize = 12.sp,
            fontWeight = FontWeight.Normal,
            maxLines = 1
        )
    }
}
