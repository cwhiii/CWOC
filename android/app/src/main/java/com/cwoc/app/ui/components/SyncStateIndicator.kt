package com.cwoc.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.sync.SyncState

/**
 * A small colored dot indicating the current sync state.
 * Designed for placement in a TopAppBar.
 *
 * - ONLINE_IDLE → green dot (connected, idle)
 * - SYNCING → orange dot with pulsing animation (actively syncing)
 * - OFFLINE → red dot (no network)
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
@Composable
fun SyncStateIndicator(
    syncState: SyncState,
    modifier: Modifier = Modifier
) {
    val color = when (syncState) {
        SyncState.ONLINE_IDLE -> Color(0xFF4CAF50) // Green
        SyncState.SYNCING -> Color(0xFFFF9800)     // Orange
        SyncState.OFFLINE -> Color(0xFFF44336)     // Red
    }

    val description = when (syncState) {
        SyncState.ONLINE_IDLE -> "Online and synced"
        SyncState.SYNCING -> "Syncing in progress"
        SyncState.OFFLINE -> "Offline"
    }

    // Pulsing animation for SYNCING state
    val alpha = if (syncState == SyncState.SYNCING) {
        val infiniteTransition = rememberInfiniteTransition(label = "syncPulse")
        val animatedAlpha by infiniteTransition.animateFloat(
            initialValue = 1f,
            targetValue = 0.3f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 800, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "syncPulseAlpha"
        )
        animatedAlpha
    } else {
        1f
    }

    Box(
        modifier = modifier
            .size(10.dp)
            .alpha(alpha)
            .background(color = color, shape = CircleShape)
            .semantics { contentDescription = description }
    )
}
