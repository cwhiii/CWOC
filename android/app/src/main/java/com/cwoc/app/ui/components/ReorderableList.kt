package com.cwoc.app.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlin.math.roundToInt

/**
 * A LazyColumn wrapper that supports long-press drag-to-reorder.
 * Matches the web's enableDragToReorder behavior for chit card lists.
 *
 * When the user long-presses and drags a card, it visually lifts and moves with the finger.
 * On drop, the onReorder callback is invoked with the from/to indices.
 *
 * If the user long-presses but does NOT drag (holds still), the onLongPressItem callback
 * is invoked — this opens the action menu, matching mobile web behavior.
 *
 * @param items The list of items to display
 * @param key A function to extract a stable key from each item
 * @param onReorder Callback with (fromIndex, toIndex) when a drag completes
 * @param onLongPressItem Callback when long-press completes without drag (action menu)
 * @param enabled Whether drag-to-reorder is enabled (only when sort is "manual")
 * @param itemContent The composable content for each item
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun <T> ReorderableLazyColumn(
    items: List<T>,
    key: (T) -> Any,
    onReorder: (fromIndex: Int, toIndex: Int) -> Unit,
    onLongPressItem: ((T) -> Unit)? = null,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(0.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(6.dp),
    listState: LazyListState = rememberLazyListState(),
    itemContent: @Composable (item: T, isDragging: Boolean) -> Unit
) {
    var draggedIndex by remember { mutableIntStateOf(-1) }
    var dragOffsetY by remember { mutableFloatStateOf(0f) }
    var targetIndex by remember { mutableIntStateOf(-1) }
    var didDrag by remember { mutableStateOf(false) }

    LazyColumn(
        state = listState,
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = verticalArrangement
    ) {
        items(items.size, key = { index -> key(items[index]) }) { index ->
            val item = items[index]
            val isDragging = draggedIndex == index

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .zIndex(if (isDragging) 1f else 0f)
                    .offset { IntOffset(0, if (isDragging) dragOffsetY.roundToInt() else 0) }
                    .graphicsLayer {
                        if (isDragging) {
                            shadowElevation = 8f
                            scaleX = 1.02f
                            scaleY = 1.02f
                        }
                    }
                    .then(
                        if (enabled) {
                            Modifier.pointerInput(Unit) {
                                detectDragGesturesAfterLongPress(
                                    onDragStart = {
                                        draggedIndex = index
                                        dragOffsetY = 0f
                                        didDrag = false
                                    },
                                    onDrag = { change, dragAmount ->
                                        change.consume()
                                        dragOffsetY += dragAmount.y
                                        didDrag = true

                                        // Calculate target index based on drag offset
                                        val itemHeight = size.height.toFloat()
                                        if (itemHeight > 0) {
                                            val rawTarget = index + (dragOffsetY / itemHeight).roundToInt()
                                            targetIndex = rawTarget.coerceIn(0, items.size - 1)
                                        }
                                    },
                                    onDragEnd = {
                                        if (didDrag && draggedIndex >= 0 && targetIndex >= 0 && draggedIndex != targetIndex) {
                                            onReorder(draggedIndex, targetIndex)
                                        } else if (!didDrag && draggedIndex >= 0) {
                                            // Long press without drag → action menu
                                            onLongPressItem?.invoke(items[draggedIndex])
                                        }
                                        draggedIndex = -1
                                        dragOffsetY = 0f
                                        targetIndex = -1
                                        didDrag = false
                                    },
                                    onDragCancel = {
                                        if (!didDrag && draggedIndex >= 0) {
                                            // Long press cancelled without drag → action menu
                                            onLongPressItem?.invoke(items[draggedIndex])
                                        }
                                        draggedIndex = -1
                                        dragOffsetY = 0f
                                        targetIndex = -1
                                        didDrag = false
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
