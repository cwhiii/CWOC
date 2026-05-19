package com.cwoc.app.ui.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown



/**
 * Right-swipe views panel — slides in from the right edge showing the user's
 * configured visible views. Matches the mobile web's tab bar behavior:
 * only shows views enabled in the view_order setting, in their configured order.
 * - Swipe left from right edge to open
 * - Swipe right to close
 * - Tap backdrop to close
 * - Tap a view to navigate to it
 */
@Composable
fun ViewsPanel(
    isOpen: Boolean,
    currentRoute: String?,
    onNavigate: (String) -> Unit,
    onDismiss: () -> Unit,
    orderedMainTabs: List<CCaptnTab> = CCaptnTab.entries.toList(),
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.fillMaxSize()) {
        // Backdrop
        AnimatedVisibility(
            visible = isOpen,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.4f))
                    .clickable(onClick = onDismiss)
            )
        }

        // Panel sliding in from right
        AnimatedVisibility(
            visible = isOpen,
            enter = slideInHorizontally(initialOffsetX = { it }),
            exit = slideOutHorizontally(targetOffsetX = { it }),
            modifier = Modifier.align(Alignment.CenterEnd)
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(260.dp)
                    .pointerInput(Unit) {
                        detectHorizontalDragGestures { _, dragAmount ->
                            // Swipe right to close
                            if (dragAmount > 40f) {
                                onDismiss()
                            }
                        }
                    },
                color = Color(0xFFFFFAF0), // Parchment background
                shadowElevation = 8.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = 16.dp)
                ) {
                    // Header
                    Text(
                        text = "Views",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = CwocZoneHeaderBrown,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )

                    HorizontalDivider(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        color = Color(0xFF8B5A2B).copy(alpha = 0.3f)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // C CAPTN views (in settings-determined order)
                    orderedMainTabs.forEach { tab ->
                        val isSelected = tab.route == currentRoute
                        ViewsPanelItem(
                            label = tab.label,
                            icon = tab.icon,
                            isSelected = isSelected,
                            onClick = {
                                onNavigate(tab.route)
                                onDismiss()
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Close button at bottom
                    HorizontalDivider(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        color = Color(0xFF8B5A2B).copy(alpha = 0.3f)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "⇤ Hide",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = CwocZoneHeaderBrown,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(onClick = onDismiss)
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ViewsPanelItem(
    label: String,
    icon: ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(
                if (isSelected) Color(0xFF8B5A2B).copy(alpha = 0.12f)
                else Color.Transparent
            )
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            modifier = Modifier.size(20.dp),
            tint = if (isSelected) CwocZoneHeaderBrown
                   else Color(0xFF4A2C2A).copy(alpha = 0.7f)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            color = if (isSelected) CwocZoneHeaderBrown else Color(0xFF2B1E0F)
        )
    }
}

/**
 * Edge swipe detector — wraps content and detects swipe-from-right-edge gestures.
 * When a left swipe is detected starting from within EDGE_ZONE px of the right edge,
 * it triggers onOpenPanel.
 */
@Composable
fun RightEdgeSwipeDetector(
    onOpenPanel: () -> Unit,
    content: @Composable () -> Unit
) {
    val edgeZone = 25.dp // Match web's 25px edge zone

    Box(modifier = Modifier.fillMaxSize()) {
        content()

        // Invisible touch target along right edge
        Box(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .width(edgeZone)
                .fillMaxHeight()
                .pointerInput(Unit) {
                    detectHorizontalDragGestures { _, dragAmount ->
                        // Swipe left from right edge → open panel
                        if (dragAmount < -40f) {
                            onOpenPanel()
                        }
                    }
                }
        )
    }
}
