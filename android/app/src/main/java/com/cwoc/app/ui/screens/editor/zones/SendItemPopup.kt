package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import com.cwoc.app.ui.theme.CwocButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.cwoc.app.data.local.entity.ChitEntity

/**
 * SendItemPopup — A Popup composable anchored near the tapped checklist item.
 *
 * Shows:
 * - "New Chit" row (tap to reveal Move/Copy buttons)
 * - 3 most recent chits (titles truncated to 30 chars, each with Copy 📋 and Move 📤 buttons)
 * - "Search..." button at the bottom
 *
 * @param recentChits The 3 most recently modified chits (pre-fetched with 2-min cache)
 * @param onCopy Callback when Copy is tapped on a recent chit (targetChitId)
 * @param onMove Callback when Move is tapped on a recent chit (targetChitId)
 * @param onNewChitCopy Callback when Copy is tapped for "New Chit"
 * @param onNewChitMove Callback when Move is tapped for "New Chit"
 * @param onSearch Callback when "Search..." is tapped
 * @param onDismiss Callback when the popup is dismissed (tap outside)
 */
@Composable
fun SendItemPopup(
    recentChits: List<ChitEntity>,
    onCopy: (targetChitId: String) -> Unit,
    onMove: (targetChitId: String) -> Unit,
    onNewChitCopy: () -> Unit,
    onNewChitMove: () -> Unit,
    onSearch: () -> Unit,
    onDismiss: () -> Unit
) {
    var showNewChitButtons by remember { mutableStateOf(false) }

    Popup(
        alignment = Alignment.TopEnd,
        offset = IntOffset(0, 0),
        onDismissRequest = onDismiss,
        properties = PopupProperties(
            focusable = true,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Column(
            modifier = Modifier
                .width(260.dp)
                .shadow(8.dp, RoundedCornerShape(8.dp))
                .background(Color(0xFFFDF5E6), RoundedCornerShape(8.dp))
                .padding(8.dp)
        ) {
            // ── Header ───────────────────────────────────────────────────────
            Text(
                text = "Send Item to...",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF4A2C2A),
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )

            HorizontalDivider(color = Color(0xFF8B5A2B), thickness = 1.dp)

            Spacer(modifier = Modifier.height(4.dp))

            // ── "New Chit" Row ───────────────────────────────────────────────
            if (!showNewChitButtons) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showNewChitButtons = true }
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "✨ New Chit",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF008080)
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = "▶",
                        fontSize = 11.sp,
                        color = Color(0xFF8B5A2B).copy(alpha = 0.6f)
                    )
                }
            } else {
                // Expanded: show Move/Copy buttons for new chit
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "✨ New Chit",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF008080)
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        OutlinedButton(
                            onClick = {
                                onNewChitCopy()
                            },
                            modifier = Modifier.height(30.dp),
                            colors = CwocButtonDefaults.outsetColors(),
                            border = CwocButtonDefaults.outsetBorder,
                            shape = CwocButtonDefaults.outsetShape,
                            contentPadding = ButtonDefaults.ContentPadding.let {
                                androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                            }
                        ) {
                            Text("📋", fontSize = 12.sp)
                        }
                        Button(
                            onClick = {
                                onNewChitMove()
                            },
                            modifier = Modifier.height(30.dp),
                            colors = CwocButtonDefaults.outsetColors(),
                            border = CwocButtonDefaults.outsetBorder,
                            shape = CwocButtonDefaults.outsetShape,
                            contentPadding = ButtonDefaults.ContentPadding.let {
                                androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                            }
                        ) {
                            Text("📤", fontSize = 12.sp)
                        }
                    }
                }
            }

            HorizontalDivider(
                color = Color(0xFF8B5A2B),
                thickness = 1.dp,
                modifier = Modifier.padding(vertical = 2.dp)
            )

            // ── Recent Chits (up to 3) ───────────────────────────────────────
            if (recentChits.isEmpty()) {
                Text(
                    text = "No recent chits",
                    fontSize = 12.sp,
                    color = Color(0xFF4A2C2A).copy(alpha = 0.5f),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                )
            } else {
                recentChits.forEach { chit ->
                    SendItemRecentChitRow(
                        title = (chit.title ?: "(untitled)").take(30),
                        onCopy = { onCopy(chit.id) },
                        onMove = { onMove(chit.id) }
                    )
                }
            }

            HorizontalDivider(
                color = Color(0xFF8B5A2B),
                thickness = 1.dp,
                modifier = Modifier.padding(vertical = 2.dp)
            )

            // ── "Search..." Button ───────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSearch() }
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "🔍 Search...",
                    fontSize = 14.sp,
                    color = Color(0xFF8B5A2B),
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

/**
 * A single row in the SendItemPopup showing a recent chit title with Copy and Move buttons.
 */
@Composable
private fun SendItemRecentChitRow(
    title: String,
    onCopy: () -> Unit,
    onMove: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Chit title (truncated)
        Text(
            text = title,
            fontSize = 13.sp,
            color = Color(0xFF4A2C2A),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )

        Spacer(modifier = Modifier.width(6.dp))

        // Copy button (📋)
        OutlinedButton(
            onClick = onCopy,
            modifier = Modifier.height(28.dp),
            colors = CwocButtonDefaults.outsetColors(),
            border = CwocButtonDefaults.outsetBorder,
            shape = CwocButtonDefaults.outsetShape,
            contentPadding = ButtonDefaults.ContentPadding.let {
                androidx.compose.foundation.layout.PaddingValues(horizontal = 6.dp, vertical = 0.dp)
            }
        ) {
            Text("📋", fontSize = 12.sp)
        }

        Spacer(modifier = Modifier.width(4.dp))

        // Move button (📤)
        Button(
            onClick = onMove,
            modifier = Modifier.height(28.dp),
            colors = CwocButtonDefaults.outsetColors(),
            border = CwocButtonDefaults.outsetBorder,
            shape = CwocButtonDefaults.outsetShape,
            contentPadding = ButtonDefaults.ContentPadding.let {
                androidx.compose.foundation.layout.PaddingValues(horizontal = 6.dp, vertical = 0.dp)
            }
        ) {
            Text("📤", fontSize = 12.sp)
        }
    }
}
