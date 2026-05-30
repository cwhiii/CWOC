package com.cwoc.app.ui.screens.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CenterFocusWeak
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// ─── Constants ──────────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ZOOM_MIN = 0.25f
private val ZOOM_MAX = 3.0f
private val ZOOM_STEP = 0.25f
private val BUTTON_SIZE = 40.dp

// ─── TimelineZoomControls Composable ────────────────────────────────────────────

/**
 * Zoom control buttons for the timeline view: zoom in (+), zoom out (-), recenter.
 * Positioned in a vertical column — the parent composable handles bottom-right placement.
 *
 * - Zoom in: increases timelineZoom by 0.25, capped at 3.0x
 * - Zoom out: decreases timelineZoom by 0.25, capped at 0.25x
 * - Recenter: resets zoom to 1.0x and offset to Offset.Zero (show all nodes)
 *
 * Validates: Requirements 23.3, 23.4
 */
@Composable
fun TimelineZoomControls(
    currentZoom: Float,
    onZoomIn: () -> Unit,
    onZoomOut: () -> Unit,
    onRecenter: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Zoom In (+)
        FloatingActionButton(
            onClick = onZoomIn,
            modifier = Modifier.size(BUTTON_SIZE),
            containerColor = ParchmentBrown,
            contentColor = Color.White,
            shape = RoundedCornerShape(8.dp),
            elevation = FloatingActionButtonDefaults.elevation(
                defaultElevation = 2.dp,
                pressedElevation = 4.dp
            )
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "Zoom in"
            )
        }

        // Zoom Out (-)
        FloatingActionButton(
            onClick = onZoomOut,
            modifier = Modifier.size(BUTTON_SIZE),
            containerColor = ParchmentBrown,
            contentColor = Color.White,
            shape = RoundedCornerShape(8.dp),
            elevation = FloatingActionButtonDefaults.elevation(
                defaultElevation = 2.dp,
                pressedElevation = 4.dp
            )
        ) {
            Icon(
                imageVector = Icons.Default.Remove,
                contentDescription = "Zoom out"
            )
        }

        // Recenter (reset zoom to 1.0x, offset to zero)
        FloatingActionButton(
            onClick = onRecenter,
            modifier = Modifier.size(BUTTON_SIZE),
            containerColor = ParchmentBrown,
            contentColor = Color.White,
            shape = RoundedCornerShape(8.dp),
            elevation = FloatingActionButtonDefaults.elevation(
                defaultElevation = 2.dp,
                pressedElevation = 4.dp
            )
        ) {
            Icon(
                imageVector = Icons.Default.CenterFocusWeak,
                contentDescription = "Recenter timeline"
            )
        }
    }
}

/**
 * Convenience wrapper that connects TimelineZoomControls directly to a TasksViewModel.
 * Handles zoom clamping and recenter logic internally.
 *
 * Validates: Requirements 23.3, 23.4
 */
@Composable
fun TimelineZoomControls(
    viewModel: TasksViewModel,
    modifier: Modifier = Modifier
) {
    val currentZoom = viewModel.timelineZoom.value

    TimelineZoomControls(
        currentZoom = currentZoom,
        onZoomIn = {
            val newZoom = (viewModel.timelineZoom.value + ZOOM_STEP).coerceAtMost(ZOOM_MAX)
            viewModel.timelineZoom.value = newZoom
        },
        onZoomOut = {
            val newZoom = (viewModel.timelineZoom.value - ZOOM_STEP).coerceAtLeast(ZOOM_MIN)
            viewModel.timelineZoom.value = newZoom
        },
        onRecenter = {
            viewModel.timelineZoom.value = 1.0f
            viewModel.timelineOffset.value = Offset.Zero
        },
        modifier = modifier
    )
}
