package com.cwoc.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Gesture and interaction reference dialog for Android.
 * Equivalent to the web's keyboard shortcuts reference overlay.
 * Shows all available touch gestures and their actions.
 */
@Composable
fun ReferenceDialog(
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "📖 Gesture Reference",
                fontWeight = FontWeight.Bold,
                color = Color(0xFF4A3728)
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                ReferenceSection("Navigation") {
                    ReferenceItem("Swipe right from left edge", "Open sidebar")
                    ReferenceItem("Swipe left from right edge", "Open Views panel")
                    ReferenceItem("Swipe left on sidebar", "Close sidebar")
                    ReferenceItem("Tap backdrop", "Close sidebar/panel")
                }
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = Color(0xFF6B4E31).copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                ReferenceSection("Chit Interactions") {
                    ReferenceItem("Tap chit card", "Open in editor")
                    ReferenceItem("Long-press chit card", "Quick edit sheet")
                    ReferenceItem("Swipe left on chit", "Action menu")
                    ReferenceItem("Swipe right on chit", "Quick complete/pin")
                }
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = Color(0xFF6B4E31).copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                ReferenceSection("Calendar") {
                    ReferenceItem("Tap event", "Open in editor")
                    ReferenceItem("Long-press event", "Quick edit")
                    ReferenceItem("Drag event", "Move time/day")
                    ReferenceItem("Tap empty slot", "Create chit at time")
                }
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = Color(0xFF6B4E31).copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(8.dp))
                ReferenceSection("General") {
                    ReferenceItem("Pull down", "Refresh / sync")
                    ReferenceItem("Long-press New Chit", "Quick Alert")
                    ReferenceItem("Long-press Weather btn", "Weather modal")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = Color(0xFF8B5A2B))
            }
        }
    )
}

@Composable
private fun ReferenceSection(title: String, content: @Composable () -> Unit) {
    Text(
        text = title,
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF4A3728),
        modifier = Modifier.padding(bottom = 4.dp)
    )
    content()
}

@Composable
private fun ReferenceItem(gesture: String, action: String) {
    Text(
        text = "$gesture → $action",
        fontSize = 12.sp,
        color = Color(0xFF2B1E0F),
        modifier = Modifier.padding(start = 8.dp, bottom = 2.dp)
    )
}
