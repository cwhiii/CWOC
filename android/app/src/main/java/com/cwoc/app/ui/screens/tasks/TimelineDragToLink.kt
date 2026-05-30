package com.cwoc.app.ui.screens.tasks

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitLongPressOrCancellation
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Node width in dp for hit testing (matches TimelineNode NODE_WIDTH). */
private const val NODE_HIT_WIDTH_DP = 120f

/** Node height in dp for hit testing (matches TimelineNode NODE_HEIGHT). */
private const val NODE_HIT_HEIGHT_DP = 60f

/** Extra padding around nodes for easier hit detection (forgiving touch targets). */
private const val HIT_TEST_PADDING_DP = 12f

// ─── Hit Test Utility ───────────────────────────────────────────────────────────

/**
 * Performs a hit test against all node positions to find which node (if any)
 * the given touch position overlaps with.
 *
 * @param touchPosition The current touch position in canvas coordinates.
 * @param nodePositions Map of chit ID → NodePosition for all visible nodes.
 * @param excludeNodeId Optional node ID to exclude from hit testing (e.g., the source node).
 * @param density The screen density for dp-to-px conversion.
 * @return The chit ID of the hit node, or null if no node was hit.
 */
fun hitTestNode(
    touchPosition: Offset,
    nodePositions: Map<String, NodePosition>,
    excludeNodeId: String? = null,
    density: Float
): String? {
    val nodeWidth = NODE_HIT_WIDTH_DP * density
    val nodeHeight = NODE_HIT_HEIGHT_DP * density
    val padding = HIT_TEST_PADDING_DP * density

    for ((nodeId, position) in nodePositions) {
        if (nodeId == excludeNodeId) continue

        val nodeRect = Rect(
            left = position.x - padding,
            top = position.y - padding,
            right = position.x + nodeWidth + padding,
            bottom = position.y + nodeHeight + padding
        )

        if (nodeRect.contains(touchPosition)) {
            return nodeId
        }
    }

    return null
}

// ─── Drag-to-Link Gesture Modifier ─────────────────────────────────────────────

/**
 * Modifier that adds drag-to-link gesture handling to a TimelineNode.
 *
 * Behavior:
 * - On long-press, starts link creation mode (calls onDragStart)
 * - While dragging, continuously reports the touch position (calls onDrag)
 * - On release, reports the final position (calls onDragEnd)
 * - If the long-press is cancelled (finger lifted too early), does nothing
 *
 * This modifier should be applied BEFORE the detectTapGestures modifier so that
 * long-press + drag is intercepted before the simple long-press callback fires.
 *
 * @param nodeId The ID of this node (source of the drag).
 * @param enabled Whether drag-to-link is enabled (disable during link mode, etc.).
 * @param onDragStart Called when long-press is detected and drag begins. Receives the initial position.
 * @param onDrag Called continuously during drag with the current touch position (in parent coordinates).
 * @param onDragEnd Called when the finger is lifted. Receives the final touch position.
 */
fun Modifier.dragToLinkGesture(
    nodeId: String,
    enabled: Boolean = true,
    onDragStart: (Offset) -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: (Offset) -> Unit
): Modifier {
    if (!enabled) return this

    return this.pointerInput(nodeId) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            val longPress = awaitLongPressOrCancellation(down.id)

            if (longPress != null) {
                // Long press detected — start drag-to-link
                longPress.consume()
                val startPosition = longPress.position
                onDragStart(startPosition)

                // Track drag until release
                var currentPosition = startPosition
                while (true) {
                    val event = awaitPointerEvent()
                    val change = event.changes.firstOrNull() ?: break

                    if (change.changedToUp()) {
                        // Finger lifted — end drag
                        change.consume()
                        onDragEnd(currentPosition)
                        break
                    }

                    // Update position during drag
                    if (change.positionChange() != Offset.Zero) {
                        change.consume()
                        currentPosition = change.position
                        onDrag(currentPosition)
                    }
                }
            }
        }
    }
}
