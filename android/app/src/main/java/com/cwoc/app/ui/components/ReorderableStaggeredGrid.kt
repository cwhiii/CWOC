package com.cwoc.app.ui.components

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.rememberLazyStaggeredGridState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlin.math.roundToInt

/**
 * A LazyVerticalStaggeredGrid wrapper that supports long-press drag-to-reorder.
 * Matches the web's enableDragToReorder behavior for masonry/staggered card layouts
 * (Notes, Checklists).
 *
 * On long-press, the item visually lifts (elevation + scale) and follows the finger.
 * The original position is dimmed. An insertion indicator shows where the item will land.
 * On drop, the onReorder callback is invoked with the from/to indices.
 *
 * Uses an overlay-based approach:
 * - Each item's bounds are tracked via onGloballyPositioned
 * - During drag, the dragged item is rendered at an offset matching finger movement
 * - Target drop index is calculated by finding which item's bounds the drag center overlaps
 *
 * @param items The list of items to display
 * @param key A function to extract a stable key from each item
 * @param columns The staggered grid column configuration
 * @param onReorder Callback with (fromIndex, toIndex) when a drag completes
 * @param enabled Whether drag-to-reorder is enabled (only when sort is "manual")
 * @param modifier Modifier for the grid container
 * @param contentPadding Padding around the grid content
 * @param verticalItemSpacing Vertical spacing between items
 * @param horizontalArrangement Horizontal arrangement/spacing between columns
 * @param itemContent The composable content for each item; receives the item and whether it's being dragged
 */
@Composable
fun <T> ReorderableStaggeredGrid(
    items: List<T>,
    key: (T) -> Any,
    columns: StaggeredGridCells,
    onReorder: (fromIndex: Int, toIndex: Int) -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(0.dp),
    verticalItemSpacing: Dp = 8.dp,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.spacedBy(8.dp),
    itemContent: @Composable (item: T, isDragging: Boolean) -> Unit
) {
    val gridState = rememberLazyStaggeredGridState()

    // Drag state
    var draggedIndex by remember { mutableIntStateOf(-1) }
    var dragOffsetX by remember { mutableFloatStateOf(0f) }
    var dragOffsetY by remember { mutableFloatStateOf(0f) }
    var targetIndex by remember { mutableIntStateOf(-1) }

    // Track bounds of each item for hit-testing during drag
    val itemBounds = remember { mutableStateMapOf<Int, Rect>() }

    // Container bounds offset for coordinate translation
    var containerOffset by remember { mutableStateOf(Offset.Zero) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .onGloballyPositioned { coordinates ->
                containerOffset = Offset(
                    coordinates.boundsInParent().left,
                    coordinates.boundsInParent().top
                )
            }
    ) {
        LazyVerticalStaggeredGrid(
            state = gridState,
            columns = columns,
            modifier = Modifier.fillMaxSize(),
            contentPadding = contentPadding,
            verticalItemSpacing = verticalItemSpacing,
            horizontalArrangement = horizontalArrangement
        ) {
            items(items.size, key = { index -> key(items[index]) }) { index ->
                val item = items[index]
                val isDragging = draggedIndex == index
                val isTarget = targetIndex == index && draggedIndex != index

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .onGloballyPositioned { coordinates ->
                            itemBounds[index] = coordinates.boundsInParent()
                        }
                        .zIndex(if (isDragging) 10f else 0f)
                        .offset {
                            if (isDragging) {
                                IntOffset(
                                    dragOffsetX.roundToInt(),
                                    dragOffsetY.roundToInt()
                                )
                            } else {
                                IntOffset.Zero
                            }
                        }
                        .graphicsLayer {
                            if (isDragging) {
                                // Elevate and slightly scale the dragged item
                                shadowElevation = 12f
                                scaleX = 1.05f
                                scaleY = 1.05f
                                alpha = 0.9f
                            } else if (isTarget) {
                                // Dim the target position as insertion indicator
                                alpha = 0.5f
                            }
                        }
                        .then(
                            if (enabled) {
                                Modifier.pointerInput(index) {
                                    detectDragGesturesAfterLongPress(
                                        onDragStart = {
                                            draggedIndex = index
                                            dragOffsetX = 0f
                                            dragOffsetY = 0f
                                            targetIndex = index
                                        },
                                        onDrag = { change, dragAmount ->
                                            change.consume()
                                            dragOffsetX += dragAmount.x
                                            dragOffsetY += dragAmount.y

                                            // Calculate target index based on where the
                                            // center of the dragged item currently is
                                            val draggedBounds = itemBounds[index]
                                            if (draggedBounds != null) {
                                                val dragCenterX = draggedBounds.center.x + dragOffsetX
                                                val dragCenterY = draggedBounds.center.y + dragOffsetY

                                                // Find which item's bounds contain the drag center
                                                var newTarget = index
                                                for ((i, bounds) in itemBounds) {
                                                    if (i == index) continue
                                                    if (bounds.contains(Offset(dragCenterX, dragCenterY))) {
                                                        newTarget = i
                                                        break
                                                    }
                                                }

                                                // If no exact hit, find the closest item
                                                if (newTarget == index && dragOffsetY != 0f) {
                                                    var minDist = Float.MAX_VALUE
                                                    for ((i, bounds) in itemBounds) {
                                                        if (i == index) continue
                                                        val dist = distanceToRect(
                                                            Offset(dragCenterX, dragCenterY),
                                                            bounds
                                                        )
                                                        if (dist < minDist) {
                                                            minDist = dist
                                                            newTarget = i
                                                        }
                                                    }
                                                    // Only snap to closest if reasonably near
                                                    if (minDist > 100f) {
                                                        newTarget = index
                                                    }
                                                }

                                                targetIndex = newTarget.coerceIn(0, items.size - 1)
                                            }
                                        },
                                        onDragEnd = {
                                            if (draggedIndex >= 0 && targetIndex >= 0 && draggedIndex != targetIndex) {
                                                onReorder(draggedIndex, targetIndex)
                                            }
                                            draggedIndex = -1
                                            dragOffsetX = 0f
                                            dragOffsetY = 0f
                                            targetIndex = -1
                                        },
                                        onDragCancel = {
                                            draggedIndex = -1
                                            dragOffsetX = 0f
                                            dragOffsetY = 0f
                                            targetIndex = -1
                                        }
                                    )
                                }
                            } else Modifier
                        )
                ) {
                    itemContent(item, isDragging)
                }
            }
        }
    }
}

/**
 * Calculate the minimum distance from a point to a rectangle.
 * Returns 0 if the point is inside the rectangle.
 */
private fun distanceToRect(point: Offset, rect: Rect): Float {
    val dx = maxOf(rect.left - point.x, 0f, point.x - rect.right)
    val dy = maxOf(rect.top - point.y, 0f, point.y - rect.bottom)
    return kotlin.math.sqrt(dx * dx + dy * dy)
}
