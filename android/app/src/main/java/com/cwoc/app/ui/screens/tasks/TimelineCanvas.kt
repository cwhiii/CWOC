package com.cwoc.app.ui.screens.tasks

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Minimum zoom level (25%). */
private const val MIN_ZOOM = 0.25f

/** Maximum zoom level (300%). */
private const val MAX_ZOOM = 3.0f

/** Default dependency line width. */
private val LINE_WIDTH_DEFAULT = 2.dp

/** Highlighted dependency line width. */
private val LINE_WIDTH_HIGHLIGHTED = 4.dp

/** Critical path dependency line width. */
private val LINE_WIDTH_CRITICAL = 4.dp

/** Drag-to-link preview line width. */
private val LINE_WIDTH_DRAG_PREVIEW = 2.dp

/** Default dependency line color (muted brown). */
private val LineColorDefault = Color(0xFF8B7355)

/** Highlighted dependency line color (brighter gold). */
private val LineColorHighlighted = Color(0xFFD4A017)

/** Critical path line color (distinct orange-red). */
private val LineColorCritical = Color(0xFFE65100)

/** Drag-to-link preview line color (teal). */
private val LineColorDragPreview = Color(0xFF008080)

/** Node width in pixels (matches TimelineNode NODE_WIDTH = 120.dp equivalent). */
private const val NODE_WIDTH_PX = 120f

/** Node height in pixels (matches TimelineNode NODE_HEIGHT = 60.dp equivalent). */
private const val NODE_HEIGHT_PX = 60f

// ─── Data Classes ───────────────────────────────────────────────────────────────

/**
 * Represents the current drag-to-link state.
 * When active, a preview line is drawn from the source node to the current touch position.
 */
data class DragLinkState(
    val sourceNodeId: String,
    val sourcePosition: Offset,
    val currentTouchPosition: Offset
)

/**
 * Represents a single dependency edge to be drawn on the canvas.
 */
data class DependencyEdge(
    val fromNodeId: String,
    val toNodeId: String,
    val fromPosition: Offset,
    val toPosition: Offset
)

// ─── TimelineCanvas Composable ──────────────────────────────────────────────────

/**
 * Canvas composable for the timeline dependency graph.
 *
 * Provides:
 * - Pinch-zoom via detectTransformGestures (clamped to 0.25x–3.0x)
 * - Pan via detectDragGestures on empty canvas space
 * - Dependency lines connecting prerequisite nodes to dependent nodes
 * - Highlighted lines when a node is highlighted
 * - Critical path lines with distinct styling
 * - Drag-to-link preview line during dependency creation
 *
 * The content (TimelineNode composables) is placed inside the Box and transformed
 * together with the canvas via graphicsLayer.
 *
 * @param zoom Current zoom level (0.25f to 3.0f)
 * @param offset Current pan offset
 * @param nodePositions Map of chit ID → NodePosition for all visible nodes
 * @param graph The dependency graph (forward/reverse adjacency maps)
 * @param highlightedNodes Set of node IDs currently highlighted
 * @param criticalPathNodes Set of node IDs on the critical path (when active)
 * @param dragLinkState Current drag-to-link state (null when not dragging)
 * @param onZoomChange Callback when zoom changes (from pinch gesture)
 * @param onOffsetChange Callback when offset changes (from pan gesture)
 * @param onTapEmptySpace Callback when user taps empty canvas (clears highlighting)
 * @param content Slot for TimelineNode composables positioned absolutely
 */
@Composable
fun TimelineCanvas(
    zoom: Float,
    offset: Offset,
    nodePositions: Map<String, NodePosition>,
    graph: DependencyGraph,
    highlightedNodes: Set<String>,
    criticalPathNodes: Set<String>,
    dragLinkState: DragLinkState?,
    onZoomChange: (Float) -> Unit,
    onOffsetChange: (Offset) -> Unit,
    onTapEmptySpace: () -> Unit,
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            // Pinch-zoom gesture
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, gestureZoom, _ ->
                    // Apply zoom change, clamped to range
                    val newZoom = (zoom * gestureZoom).coerceIn(MIN_ZOOM, MAX_ZOOM)
                    onZoomChange(newZoom)

                    // Apply pan from the transform gesture as well
                    val newOffset = Offset(
                        x = offset.x + pan.x,
                        y = offset.y + pan.y
                    )
                    onOffsetChange(newOffset)
                }
            }
            // Pan gesture (drag on empty space)
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    val newOffset = Offset(
                        x = offset.x + dragAmount.x,
                        y = offset.y + dragAmount.y
                    )
                    onOffsetChange(newOffset)
                }
            }
    ) {
        // Transformed container: zoom + pan applied via graphicsLayer
        Box(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = zoom
                    scaleY = zoom
                    translationX = offset.x
                    translationY = offset.y
                }
        ) {
            // Draw dependency lines on Canvas (behind nodes)
            Canvas(modifier = Modifier.fillMaxSize()) {
                val edges = buildDependencyEdges(nodePositions, graph)

                for (edge in edges) {
                    val isHighlighted = edge.fromNodeId in highlightedNodes &&
                            edge.toNodeId in highlightedNodes
                    val isCriticalPath = edge.fromNodeId in criticalPathNodes &&
                            edge.toNodeId in criticalPathNodes

                    // Determine line style based on state priority:
                    // critical path > highlighted > default
                    val lineColor: Color
                    val lineWidth: Float

                    when {
                        isCriticalPath -> {
                            lineColor = LineColorCritical
                            lineWidth = LINE_WIDTH_CRITICAL.toPx()
                        }
                        isHighlighted -> {
                            lineColor = LineColorHighlighted
                            lineWidth = LINE_WIDTH_HIGHLIGHTED.toPx()
                        }
                        else -> {
                            lineColor = LineColorDefault
                            lineWidth = LINE_WIDTH_DEFAULT.toPx()
                        }
                    }

                    // Draw the dependency line from right edge of source to left edge of target
                    drawLine(
                        color = lineColor,
                        start = edge.fromPosition,
                        end = edge.toPosition,
                        strokeWidth = lineWidth,
                        cap = StrokeCap.Round
                    )
                }

                // Draw drag-to-link preview line (dashed)
                if (dragLinkState != null) {
                    val dashEffect = PathEffect.dashPathEffect(
                        floatArrayOf(12f, 8f),
                        phase = 0f
                    )
                    drawLine(
                        color = LineColorDragPreview,
                        start = dragLinkState.sourcePosition,
                        end = dragLinkState.currentTouchPosition,
                        strokeWidth = LINE_WIDTH_DRAG_PREVIEW.toPx(),
                        cap = StrokeCap.Round,
                        pathEffect = dashEffect
                    )
                }
            }

            // Render node composables (positioned by the caller)
            content()
        }
    }
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Build the list of dependency edges with computed start/end positions.
 * Lines connect from the right edge of prerequisite nodes to the left edge of dependent nodes.
 *
 * @param nodePositions Map of chit ID → NodePosition
 * @param graph The dependency graph with forward adjacency
 * @return List of DependencyEdge with pixel positions for drawing
 */
private fun buildDependencyEdges(
    nodePositions: Map<String, NodePosition>,
    graph: DependencyGraph
): List<DependencyEdge> {
    val edges = mutableListOf<DependencyEdge>()

    for ((prereqId, dependentIds) in graph.forward) {
        val fromPos = nodePositions[prereqId] ?: continue

        for (dependentId in dependentIds) {
            val toPos = nodePositions[dependentId] ?: continue

            // From: right edge center of prerequisite node
            val fromPoint = Offset(
                x = fromPos.x + NODE_WIDTH_PX,
                y = fromPos.y + NODE_HEIGHT_PX / 2f
            )

            // To: left edge center of dependent node
            val toPoint = Offset(
                x = toPos.x,
                y = toPos.y + NODE_HEIGHT_PX / 2f
            )

            edges.add(
                DependencyEdge(
                    fromNodeId = prereqId,
                    toNodeId = dependentId,
                    fromPosition = fromPoint,
                    toPosition = toPoint
                )
            )
        }
    }

    return edges
}
