package com.cwoc.app.ui.screens.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.components.CwocChitCardStyle

// ─── Constants ──────────────────────────────────────────────────────────────────

private val NODE_WIDTH = 120.dp
private val NODE_HEIGHT = 60.dp
private val NODE_CORNER_RADIUS = 8.dp
private val NODE_BORDER_WIDTH = 2.dp
private val HIGHLIGHT_BORDER_WIDTH = 3.dp
private val CRITICAL_PATH_BORDER_WIDTH = 3.dp
private val LINK_SOURCE_BORDER_WIDTH = 3.dp

// Status → border color mapping (matches TasksScreen statusColor)
private fun statusBorderColor(status: String?): Color = when (status) {
    "ToDo" -> Color(0xFF8B5A2B)
    "In Progress" -> Color(0xFFD68A59)
    "Blocked" -> Color(0xFFB22222)
    "Complete" -> Color(0xFF5A8A5B)
    "Rejected" -> Color(0xFF9E9E9E)
    else -> Color(0xFF5C4A3A)
}

// Critical path border color (distinct red-orange)
private val CriticalPathColor = Color(0xFFE65100)

// Highlight border color (brighter gold)
private val HighlightBorderColor = Color(0xFFD4A017)

// Link source indicator color (teal pulsing)
private val LinkSourceColor = Color(0xFF008080)

// ─── TimelineNode Composable ────────────────────────────────────────────────────

/**
 * Renders a single task node in the timeline dependency graph.
 *
 * Visual states:
 * - Default: chit color background with status-based border
 * - Greyed out: grayscale + reduced opacity (completed tasks when toggle active)
 * - Highlighted: brighter border, slight elevation
 * - Critical path: distinct orange border
 * - Link source: dashed teal border indicator
 *
 * Gesture disambiguation:
 * - Single tap → highlight node and connected neighbors
 * - Double tap → open chit editor
 * - Long press without drag → context menu (onLongPress)
 * - Long press + drag → drag-to-link dependency creation
 */
@Composable
fun TimelineNode(
    chit: ChitEntity,
    isHighlighted: Boolean,
    isCriticalPath: Boolean,
    isGreyedOut: Boolean,
    isLinkSource: Boolean,
    dragToLinkEnabled: Boolean = true,
    onTap: () -> Unit,
    onDoubleTap: () -> Unit,
    onLongPress: () -> Unit,
    onDragLinkStart: ((Offset) -> Unit)? = null,
    onDragLinkMove: ((Offset) -> Unit)? = null,
    onDragLinkEnd: ((Offset) -> Unit)? = null
) {
    // Resolve background color from chit's custom color
    val bgColor = remember(chit.color) {
        CwocChitCardStyle.resolveChitBgColor(chit.color)
    }
    val textColor = remember(bgColor) {
        CwocChitCardStyle.contrastTextColor(bgColor)
    }

    // Determine border based on visual state priority:
    // link source > critical path > highlighted > default (status-based)
    val borderColor = when {
        isLinkSource -> LinkSourceColor
        isCriticalPath -> CriticalPathColor
        isHighlighted -> HighlightBorderColor
        else -> statusBorderColor(chit.status)
    }
    val borderWidth = when {
        isLinkSource -> LINK_SOURCE_BORDER_WIDTH
        isCriticalPath -> CRITICAL_PATH_BORDER_WIDTH
        isHighlighted -> HIGHLIGHT_BORDER_WIDTH
        else -> NODE_BORDER_WIDTH
    }

    // Elevation for highlighted state
    val elevation = if (isHighlighted) 4.dp else 1.dp

    val shape = RoundedCornerShape(NODE_CORNER_RADIUS)

    // Track whether a drag started (to suppress onLongPress when dragging)
    var isDragging = remember { false }

    Box(
        modifier = Modifier
            .size(NODE_WIDTH, NODE_HEIGHT)
            // Grey-out: grayscale + reduced opacity for completed tasks
            .graphicsLayer {
                if (isGreyedOut) {
                    alpha = 0.4f
                }
            }
            // Elevation for highlighted nodes
            .shadow(elevation = elevation, shape = shape)
            // Background
            .clip(shape)
            .background(bgColor)
            // Border — dashed for link source, solid otherwise
            .then(
                if (isLinkSource) {
                    Modifier.dashedBorder(borderWidth, borderColor, NODE_CORNER_RADIUS)
                } else {
                    Modifier.border(borderWidth, borderColor, shape)
                }
            )
            // Drag-to-link gesture: long-press + drag
            .then(
                if (dragToLinkEnabled && onDragLinkStart != null && onDragLinkMove != null && onDragLinkEnd != null) {
                    Modifier.dragToLinkGesture(
                        nodeId = chit.id,
                        enabled = true,
                        onDragStart = { position ->
                            isDragging = true
                            onDragLinkStart(position)
                        },
                        onDrag = { position ->
                            onDragLinkMove(position)
                        },
                        onDragEnd = { position ->
                            isDragging = false
                            onDragLinkEnd(position)
                        }
                    )
                } else {
                    Modifier
                }
            )
            // Gesture handling: single tap, double tap, long press (context menu only when not dragging)
            .pointerInput(chit.id) {
                detectTapGestures(
                    onTap = { onTap() },
                    onDoubleTap = { onDoubleTap() },
                    onLongPress = {
                        if (!isDragging) {
                            onLongPress()
                        }
                    }
                )
            }
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = chit.title ?: "Untitled",
            color = if (isGreyedOut) textColor.copy(alpha = 0.6f) else textColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// ─── Dashed Border Modifier ─────────────────────────────────────────────────────

/**
 * Custom modifier that draws a dashed border around the composable.
 * Used for the link-source indicator state.
 */
private fun Modifier.dashedBorder(
    width: Dp,
    color: Color,
    cornerRadius: Dp
): Modifier = this.drawBehind {
    val strokeWidth = width.toPx()
    val dashLength = 8.dp.toPx()
    val gapLength = 4.dp.toPx()
    val radius = cornerRadius.toPx()

    drawRoundRect(
        color = color,
        size = Size(size.width - strokeWidth, size.height - strokeWidth),
        topLeft = Offset(strokeWidth / 2f, strokeWidth / 2f),
        cornerRadius = CornerRadius(radius, radius),
        style = Stroke(
            width = strokeWidth,
            pathEffect = PathEffect.dashPathEffect(
                floatArrayOf(dashLength, gapLength),
                phase = 0f
            )
        )
    )
}
