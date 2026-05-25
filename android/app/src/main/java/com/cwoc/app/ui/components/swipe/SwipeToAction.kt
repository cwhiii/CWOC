package com.cwoc.app.ui.components.swipe

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxState
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Configuration for the left-swipe (EndToStart) action appearance.
 */
data class EndSwipeStyle(
    val color: Color,
    val icon: ImageVector,
    val contentDescription: String
)

/** Default snooze style: orange background + clock icon */
val SnoozeSwipeStyle = EndSwipeStyle(
    color = Color(0xFFFF9800),
    icon = Icons.Default.Schedule,
    contentDescription = "Snooze"
)

/** Delete style: red background + trash icon */
val DeleteSwipeStyle = EndSwipeStyle(
    color = Color(0xFFD32F2F),
    icon = Icons.Default.Delete,
    contentDescription = "Delete"
)

/**
 * Swipe-to-action wrapper for chit list items.
 *
 * - Right swipe (StartToEnd): Archive (green background + checkmark)
 * - Left swipe (EndToStart): Configurable via [endSwipeStyle] (defaults to snooze)
 *
 * After the swipe completes, the colored background stays visible for 600ms
 * before the action fires, giving visual feedback that the action was recognized.
 */
@Composable
fun SwipeToAction(
    onArchive: () -> Unit,
    onSnooze: () -> Unit,
    modifier: Modifier = Modifier,
    endSwipeStyle: EndSwipeStyle = SnoozeSwipeStyle,
    content: @Composable RowScope.() -> Unit
) {
    val scope = rememberCoroutineScope()

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.StartToEnd -> {
                    // Delay the action so the green background stays visible
                    scope.launch {
                        delay(600L)
                        onArchive()
                    }
                    true
                }
                SwipeToDismissBoxValue.EndToStart -> {
                    // Delay the action so the colored background stays visible
                    scope.launch {
                        delay(600L)
                        onSnooze()
                    }
                    true
                }
                SwipeToDismissBoxValue.Settled -> false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        modifier = modifier,
        backgroundContent = {
            SwipeBackground(dismissState, endSwipeStyle)
        },
        content = content
    )
}

@Composable
private fun SwipeBackground(
    dismissState: SwipeToDismissBoxState,
    endSwipeStyle: EndSwipeStyle
) {
    val direction = dismissState.dismissDirection

    val color by animateColorAsState(
        when (direction) {
            SwipeToDismissBoxValue.StartToEnd -> Color(0xFF4CAF50) // Green for archive
            SwipeToDismissBoxValue.EndToStart -> endSwipeStyle.color
            else -> Color.Transparent
        },
        label = "swipe_bg_color"
    )

    val icon = when (direction) {
        SwipeToDismissBoxValue.StartToEnd -> Icons.Default.Check
        SwipeToDismissBoxValue.EndToStart -> endSwipeStyle.icon
        else -> Icons.Default.Check
    }

    val alignment = when (direction) {
        SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
        SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
        else -> Alignment.CenterStart
    }

    val scale by animateFloatAsState(
        if (dismissState.targetValue == SwipeToDismissBoxValue.Settled) 0.75f else 1f,
        label = "swipe_icon_scale"
    )

    val contentDescription = when (direction) {
        SwipeToDismissBoxValue.StartToEnd -> "Archive"
        SwipeToDismissBoxValue.EndToStart -> endSwipeStyle.contentDescription
        else -> "Archive"
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color)
            .padding(horizontal = 20.dp),
        contentAlignment = alignment
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.scale(scale),
            tint = Color.White
        )
    }
}
