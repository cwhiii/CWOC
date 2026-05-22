package com.cwoc.app.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.cwoc.app.ui.theme.CwocPrimary
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import kotlin.math.roundToInt

/**
 * Orientation for the DragReorderList items within each zone.
 */
enum class DragReorderOrientation {
    VERTICAL,   // Items stacked vertically (default)
    HORIZONTAL  // Items flow horizontally (wrap)
}

/**
 * A vertical list that supports long-press drag to reorder items.
 * Items can also be dragged between two zones (primary and secondary).
 *
 * @param primaryItems Items in the primary (top) zone
 * @param secondaryItems Items in the secondary (bottom) zone
 * @param primaryLabel Label for the primary zone
 * @param secondaryLabel Label for the secondary zone
 * @param onReorder Called with (newPrimary, newSecondary) after a drag completes
 * @param orientation VERTICAL = items stacked, HORIZONTAL = items in a wrapping row
 * @param itemContent Composable to render each item's content (receives item ID and label)
 */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun <T> DragReorderList(
    primaryItems: List<T>,
    secondaryItems: List<T>,
    primaryLabel: String = "Visible",
    secondaryLabel: String = "Hidden",
    secondaryEmptyHint: String = "Long-press and drag items here to hide them",
    itemId: (T) -> String,
    itemLabel: (T) -> String,
    orientation: DragReorderOrientation = DragReorderOrientation.VERTICAL,
    onReorder: (primary: List<T>, secondary: List<T>) -> Unit,
    fixedFirstItem: (@Composable () -> Unit)? = null,
    itemContent: (@Composable (T, Boolean) -> Unit)? = null
) {
    // Drag state
    var draggedId by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }

    // Position tracking
    val itemPositions = remember { mutableMapOf<String, Offset>() }
    val itemSizes = remember { mutableMapOf<String, Size>() }
    var primaryZonePos by remember { mutableStateOf(Offset.Zero) }
    var primaryZoneSize by remember { mutableStateOf(Size.Zero) }
    var secondaryZonePos by remember { mutableStateOf(Offset.Zero) }
    var secondaryZoneSize by remember { mutableStateOf(Size.Zero) }

    val allItems = primaryItems + secondaryItems

    Column(modifier = Modifier.fillMaxWidth()) {
        // ─── Primary Zone ────────────────────────────────────────────────
        Text(
            text = primaryLabel,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = CwocZoneHeaderBrown,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = if (draggedId != null) 2.dp else 1.dp,
                    color = if (draggedId != null) CwocPrimary.copy(alpha = 0.4f)
                    else CwocZoneHeaderBrown.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(8.dp)
                )
                .background(Color(0xFFFFFAF0), RoundedCornerShape(8.dp))
                .padding(6.dp)
                .onGloballyPositioned { coords ->
                    primaryZonePos = coords.positionInRoot()
                    primaryZoneSize = Size(coords.size.width.toFloat(), coords.size.height.toFloat())
                }
        ) {
            // Fixed first item (e.g., Omni)
            fixedFirstItem?.invoke()

            // Draggable primary items
            if (orientation == DragReorderOrientation.HORIZONTAL) {
                androidx.compose.foundation.layout.FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    primaryItems.forEach { item ->
                        val id = itemId(item)
                        val isDragging = id == draggedId
                        DragReorderChip(
                            id = id,
                            isDragging = isDragging,
                            dragOffset = if (isDragging) dragOffset else Offset.Zero,
                            onDragStart = { draggedId = it; dragOffset = Offset.Zero },
                            onDrag = { dragOffset += it },
                            onDragEnd = {
                                resolveDragDrop(
                                    draggedId, dragOffset, primaryItems, secondaryItems,
                                    itemId, itemPositions, itemSizes,
                                    primaryZonePos, primaryZoneSize,
                                    secondaryZonePos, secondaryZoneSize,
                                    onReorder
                                )
                                draggedId = null
                                dragOffset = Offset.Zero
                            },
                            onPositioned = { posId, pos, size ->
                                itemPositions[posId] = pos
                                itemSizes[posId] = size
                            }
                        ) {
                            if (itemContent != null) {
                                itemContent(item, isDragging)
                            } else {
                                Text(text = itemLabel(item), fontSize = 13.sp, color = CwocZoneHeaderBrown)
                            }
                        }
                    }
                }
            } else {
                primaryItems.forEach { item ->
                    val id = itemId(item)
                    val isDragging = id == draggedId
                    DragReorderCell(
                        id = id,
                        isDragging = isDragging,
                        dragOffset = if (isDragging) dragOffset else Offset.Zero,
                        onDragStart = { draggedId = it; dragOffset = Offset.Zero },
                        onDrag = { dragOffset += it },
                        onDragEnd = {
                            resolveDragDrop(
                                draggedId, dragOffset, primaryItems, secondaryItems,
                                itemId, itemPositions, itemSizes,
                                primaryZonePos, primaryZoneSize,
                                secondaryZonePos, secondaryZoneSize,
                                onReorder
                            )
                            draggedId = null
                            dragOffset = Offset.Zero
                        },
                        onPositioned = { posId, pos, size ->
                            itemPositions[posId] = pos
                            itemSizes[posId] = size
                        }
                    ) {
                        if (itemContent != null) {
                            itemContent(item, isDragging)
                        } else {
                            Text(text = itemLabel(item), fontSize = 14.sp, fontWeight = FontWeight.Medium, color = CwocZoneHeaderBrown)
                        }
                    }
                }
            }
        }

        // ─── Secondary Zone ──────────────────────────────────────────────
        Text(
            text = secondaryLabel,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = CwocZoneHeaderBrown.copy(alpha = 0.6f),
            modifier = Modifier.padding(top = 12.dp, bottom = 6.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = if (draggedId != null) 2.dp else 1.dp,
                    color = if (draggedId != null) CwocPrimary.copy(alpha = 0.3f)
                    else CwocZoneHeaderBrown.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                )
                .background(Color(0xFFF5EDE0).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                .padding(6.dp)
                .onGloballyPositioned { coords ->
                    secondaryZonePos = coords.positionInRoot()
                    secondaryZoneSize = Size(coords.size.width.toFloat(), coords.size.height.toFloat())
                }
        ) {
            if (secondaryItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = secondaryEmptyHint,
                        fontSize = 12.sp,
                        color = CwocZoneHeaderBrown.copy(alpha = 0.4f),
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                    )
                }
            } else {
                if (orientation == DragReorderOrientation.HORIZONTAL) {
                    androidx.compose.foundation.layout.FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        secondaryItems.forEach { item ->
                            val id = itemId(item)
                            val isDragging = id == draggedId
                            DragReorderChip(
                                id = id,
                                isDragging = isDragging,
                                dragOffset = if (isDragging) dragOffset else Offset.Zero,
                                onDragStart = { draggedId = it; dragOffset = Offset.Zero },
                                onDrag = { dragOffset += it },
                                onDragEnd = {
                                    resolveDragDrop(
                                        draggedId, dragOffset, primaryItems, secondaryItems,
                                        itemId, itemPositions, itemSizes,
                                        primaryZonePos, primaryZoneSize,
                                        secondaryZonePos, secondaryZoneSize,
                                        onReorder
                                    )
                                    draggedId = null
                                    dragOffset = Offset.Zero
                                },
                                onPositioned = { posId, pos, size ->
                                    itemPositions[posId] = pos
                                    itemSizes[posId] = size
                                }
                            ) {
                                if (itemContent != null) {
                                    itemContent(item, isDragging)
                                } else {
                                    Text(text = itemLabel(item), fontSize = 13.sp, color = CwocZoneHeaderBrown.copy(alpha = 0.5f))
                                }
                            }
                        }
                    }
                } else {
                    secondaryItems.forEach { item ->
                        val id = itemId(item)
                        val isDragging = id == draggedId
                        DragReorderCell(
                            id = id,
                            isDragging = isDragging,
                            dragOffset = if (isDragging) dragOffset else Offset.Zero,
                            onDragStart = { draggedId = it; dragOffset = Offset.Zero },
                            onDrag = { dragOffset += it },
                            onDragEnd = {
                                resolveDragDrop(
                                    draggedId, dragOffset, primaryItems, secondaryItems,
                                    itemId, itemPositions, itemSizes,
                                    primaryZonePos, primaryZoneSize,
                                    secondaryZonePos, secondaryZoneSize,
                                    onReorder
                                )
                                draggedId = null
                                dragOffset = Offset.Zero
                            },
                            onPositioned = { posId, pos, size ->
                                itemPositions[posId] = pos
                                itemSizes[posId] = size
                            }
                        ) {
                            if (itemContent != null) {
                                itemContent(item, isDragging)
                            } else {
                                Text(text = itemLabel(item), fontSize = 14.sp, color = CwocZoneHeaderBrown.copy(alpha = 0.5f))
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * A compact chip-style draggable item for horizontal flow layouts.
 */
@Composable
private fun DragReorderChip(
    id: String,
    isDragging: Boolean,
    dragOffset: Offset,
    onDragStart: (String) -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onPositioned: (String, Offset, Size) -> Unit,
    content: @Composable () -> Unit
) {
    val elevation by animateDpAsState(
        targetValue = if (isDragging) 6.dp else 1.dp,
        label = "chipElevation"
    )

    Box(
        modifier = Modifier
            .then(
                if (isDragging) Modifier.offset { IntOffset(dragOffset.x.roundToInt(), dragOffset.y.roundToInt()) }.zIndex(10f)
                else Modifier.zIndex(0f)
            )
            .shadow(elevation, RoundedCornerShape(4.dp))
            .background(
                if (isDragging) Color(0xFFFFF8E1) else Color(0xFFE8D5B7),
                RoundedCornerShape(4.dp)
            )
            .border(
                1.dp,
                if (isDragging) CwocPrimary else CwocZoneHeaderBrown.copy(alpha = 0.5f),
                RoundedCornerShape(4.dp)
            )
            .padding(horizontal = 10.dp, vertical = 8.dp)
            .onGloballyPositioned { coords ->
                onPositioned(id, coords.positionInRoot(), Size(coords.size.width.toFloat(), coords.size.height.toFloat()))
            }
            .pointerInput(id) {
                detectDragGesturesAfterLongPress(
                    onDragStart = { onDragStart(id) },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        onDrag(Offset(dragAmount.x, dragAmount.y))
                    },
                    onDragEnd = { onDragEnd() },
                    onDragCancel = { onDragEnd() }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

@Composable
private fun DragReorderCell(
    id: String,
    isDragging: Boolean,
    dragOffset: Offset,
    onDragStart: (String) -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onPositioned: (String, Offset, Size) -> Unit,
    content: @Composable () -> Unit
) {
    val elevation by animateDpAsState(
        targetValue = if (isDragging) 8.dp else 0.dp,
        label = "cellElevation"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (isDragging) Modifier.offset { IntOffset(dragOffset.x.roundToInt(), dragOffset.y.roundToInt()) }.zIndex(10f)
                else Modifier.zIndex(0f)
            )
            .shadow(elevation, RoundedCornerShape(6.dp))
            .background(
                if (isDragging) Color(0xFFFFF8E1) else Color.Transparent,
                RoundedCornerShape(6.dp)
            )
            .then(
                if (isDragging) Modifier.border(1.dp, CwocPrimary, RoundedCornerShape(6.dp))
                else Modifier
            )
            .padding(horizontal = 10.dp, vertical = 8.dp)
            .onGloballyPositioned { coords ->
                onPositioned(id, coords.positionInRoot(), Size(coords.size.width.toFloat(), coords.size.height.toFloat()))
            }
            .pointerInput(id) {
                detectDragGesturesAfterLongPress(
                    onDragStart = { onDragStart(id) },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        onDrag(Offset(dragAmount.x, dragAmount.y))
                    },
                    onDragEnd = { onDragEnd() },
                    onDragCancel = { onDragEnd() }
                )
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Drag handle indicator
        Text("☰", fontSize = 14.sp, color = CwocZoneHeaderBrown.copy(alpha = 0.4f))
        Box(modifier = Modifier.weight(1f)) {
            content()
        }
    }
}

/**
 * Resolves where a dragged item was dropped and computes new lists.
 */
private fun <T> resolveDragDrop(
    draggedId: String?,
    dragOffset: Offset,
    primaryItems: List<T>,
    secondaryItems: List<T>,
    itemId: (T) -> String,
    itemPositions: Map<String, Offset>,
    itemSizes: Map<String, Size>,
    primaryZonePos: Offset,
    primaryZoneSize: Size,
    secondaryZonePos: Offset,
    secondaryZoneSize: Size,
    onReorder: (List<T>, List<T>) -> Unit
) {
    if (draggedId == null) return

    val allItems = primaryItems + secondaryItems
    val draggedItem = allItems.find { itemId(it) == draggedId } ?: return
    val draggedPos = itemPositions[draggedId] ?: return
    val draggedSize = itemSizes[draggedId] ?: return
    val isPrimary = primaryItems.any { itemId(it) == draggedId }

    val dropCenter = Offset(
        draggedPos.x + dragOffset.x + draggedSize.width / 2f,
        draggedPos.y + dragOffset.y + draggedSize.height / 2f
    )

    val inPrimary = pointInRect(dropCenter, primaryZonePos, primaryZoneSize)
    val inSecondary = pointInRect(dropCenter, secondaryZonePos, secondaryZoneSize)

    when {
        // Move from primary to secondary
        inSecondary && isPrimary -> {
            val newPrimary = primaryItems.filter { itemId(it) != draggedId }
            val newSecondary = secondaryItems + draggedItem
            onReorder(newPrimary, newSecondary)
        }
        // Move from secondary to primary
        inPrimary && !isPrimary -> {
            val newSecondary = secondaryItems.filter { itemId(it) != draggedId }
            // Insert at closest position in primary
            val insertIdx = findInsertIndex(draggedId, dropCenter, primaryItems, itemId, itemPositions, itemSizes)
            val newPrimary = primaryItems.toMutableList().apply { add(insertIdx, draggedItem) }
            onReorder(newPrimary, newSecondary)
        }
        // Reorder within primary
        inPrimary && isPrimary -> {
            val insertIdx = findInsertIndex(draggedId, dropCenter, primaryItems, itemId, itemPositions, itemSizes)
            val filtered = primaryItems.filter { itemId(it) != draggedId }
            val newPrimary = filtered.toMutableList().apply {
                add(insertIdx.coerceAtMost(size), draggedItem)
            }
            onReorder(newPrimary, secondaryItems)
        }
        // Reorder within secondary
        inSecondary && !isPrimary -> {
            val insertIdx = findInsertIndex(draggedId, dropCenter, secondaryItems, itemId, itemPositions, itemSizes)
            val filtered = secondaryItems.filter { itemId(it) != draggedId }
            val newSecondary = filtered.toMutableList().apply {
                add(insertIdx.coerceAtMost(size), draggedItem)
            }
            onReorder(primaryItems, newSecondary)
        }
        else -> onReorder(primaryItems, secondaryItems) // No-op
    }
}

private fun <T> findInsertIndex(
    draggedId: String,
    dropCenter: Offset,
    items: List<T>,
    itemId: (T) -> String,
    itemPositions: Map<String, Offset>,
    itemSizes: Map<String, Size>
): Int {
    // Find the item whose vertical center is closest to the drop point
    var bestIdx = items.size
    for (i in items.indices) {
        val id = itemId(items[i])
        if (id == draggedId) continue
        val pos = itemPositions[id] ?: continue
        val size = itemSizes[id] ?: continue
        val itemCenterY = pos.y + size.height / 2f
        if (dropCenter.y < itemCenterY) {
            bestIdx = i
            break
        }
    }
    return bestIdx
}

private fun pointInRect(point: Offset, pos: Offset, size: Size): Boolean {
    return point.x in pos.x..(pos.x + size.width) && point.y in pos.y..(pos.y + size.height)
}
