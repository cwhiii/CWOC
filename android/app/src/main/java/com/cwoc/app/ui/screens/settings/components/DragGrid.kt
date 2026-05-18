package com.cwoc.app.ui.screens.settings.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.cwoc.app.ui.theme.CwocPrimary
import com.cwoc.app.ui.theme.CwocSurfaceVariant
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import kotlin.math.roundToInt

/**
 * Represents which zone a drag item belongs to.
 */
enum class DragZone {
    ACTIVE,
    INACTIVE
}

/**
 * Orientation for the DragGrid layout.
 * HORIZONTAL: Active zone above Inactive zone (stacked vertically).
 * VERTICAL: Active zone and Inactive zone side by side.
 */
enum class DragGridOrientation {
    HORIZONTAL,
    VERTICAL
}

/**
 * A single draggable item in the DragGrid.
 *
 * @param id Unique identifier for this item.
 * @param label Display label for this item.
 * @param zone Which zone (ACTIVE or INACTIVE) this item currently belongs to.
 */
data class DragItem(
    val id: String,
    val label: String,
    val zone: DragZone
)

/**
 * A composable grid that supports long-press drag to reorder items within the Active zone
 * and drag items between Active and Inactive zones.
 *
 * Used for the clocks drag-reorder grid and Omni layout configurator.
 *
 * @param items The full list of DragItems (both ACTIVE and INACTIVE).
 * @param onReorder Callback invoked with the new item list after each drag completes.
 * @param columns Number of columns in the grid layout.
 * @param orientation Layout orientation (HORIZONTAL = stacked, VERTICAL = side by side).
 */
@Composable
fun DragGrid(
    items: List<DragItem>,
    onReorder: (List<DragItem>) -> Unit,
    columns: Int = 2,
    orientation: DragGridOrientation = DragGridOrientation.HORIZONTAL
) {
    val activeItems = items.filter { it.zone == DragZone.ACTIVE }
    val inactiveItems = items.filter { it.zone == DragZone.INACTIVE }

    // Track drag state
    var draggedItemId by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }

    // Track positions of all item cells for hit-testing
    val itemPositions = remember { mutableMapOf<String, Offset>() }
    val itemSizes = remember { mutableMapOf<String, androidx.compose.ui.geometry.Size>() }

    // Track zone positions for determining drop target zone
    var activeZonePosition by remember { mutableStateOf(Offset.Zero) }
    var activeZoneSize by remember { mutableStateOf(androidx.compose.ui.geometry.Size.Zero) }
    var inactiveZonePosition by remember { mutableStateOf(Offset.Zero) }
    var inactiveZoneSize by remember { mutableStateOf(androidx.compose.ui.geometry.Size.Zero) }

    // The item currently being dragged
    val draggedItem = items.find { it.id == draggedItemId }

    if (orientation == DragGridOrientation.HORIZONTAL) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Active zone
            DragZoneSection(
                title = "Active",
                items = activeItems,
                columns = columns,
                draggedItemId = draggedItemId,
                dragOffset = dragOffset,
                onDragStart = { id -> draggedItemId = id },
                onDrag = { offset -> dragOffset += offset },
                onDragEnd = {
                    handleDragEnd(
                        draggedItemId = draggedItemId,
                        dragOffset = dragOffset,
                        items = items,
                        itemPositions = itemPositions,
                        itemSizes = itemSizes,
                        activeZonePosition = activeZonePosition,
                        activeZoneSize = activeZoneSize,
                        inactiveZonePosition = inactiveZonePosition,
                        inactiveZoneSize = inactiveZoneSize,
                        onReorder = onReorder
                    )
                    draggedItemId = null
                    dragOffset = Offset.Zero
                },
                onPositionItem = { id, position, size ->
                    itemPositions[id] = position
                    itemSizes[id] = size
                },
                onPositionZone = { position, size ->
                    activeZonePosition = position
                    activeZoneSize = size
                },
                zoneType = DragZone.ACTIVE
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Inactive zone
            DragZoneSection(
                title = "Inactive",
                items = inactiveItems,
                columns = columns,
                draggedItemId = draggedItemId,
                dragOffset = dragOffset,
                onDragStart = { id -> draggedItemId = id },
                onDrag = { offset -> dragOffset += offset },
                onDragEnd = {
                    handleDragEnd(
                        draggedItemId = draggedItemId,
                        dragOffset = dragOffset,
                        items = items,
                        itemPositions = itemPositions,
                        itemSizes = itemSizes,
                        activeZonePosition = activeZonePosition,
                        activeZoneSize = activeZoneSize,
                        inactiveZonePosition = inactiveZonePosition,
                        inactiveZoneSize = inactiveZoneSize,
                        onReorder = onReorder
                    )
                    draggedItemId = null
                    dragOffset = Offset.Zero
                },
                onPositionItem = { id, position, size ->
                    itemPositions[id] = position
                    itemSizes[id] = size
                },
                onPositionZone = { position, size ->
                    inactiveZonePosition = position
                    inactiveZoneSize = size
                },
                zoneType = DragZone.INACTIVE
            )
        }
    } else {
        // VERTICAL orientation: side by side
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Active zone (left)
            Box(modifier = Modifier.weight(1f)) {
                DragZoneSection(
                    title = "Active",
                    items = activeItems,
                    columns = columns,
                    draggedItemId = draggedItemId,
                    dragOffset = dragOffset,
                    onDragStart = { id -> draggedItemId = id },
                    onDrag = { offset -> dragOffset += offset },
                    onDragEnd = {
                        handleDragEnd(
                            draggedItemId = draggedItemId,
                            dragOffset = dragOffset,
                            items = items,
                            itemPositions = itemPositions,
                            itemSizes = itemSizes,
                            activeZonePosition = activeZonePosition,
                            activeZoneSize = activeZoneSize,
                            inactiveZonePosition = inactiveZonePosition,
                            inactiveZoneSize = inactiveZoneSize,
                            onReorder = onReorder
                        )
                        draggedItemId = null
                        dragOffset = Offset.Zero
                    },
                    onPositionItem = { id, position, size ->
                        itemPositions[id] = position
                        itemSizes[id] = size
                    },
                    onPositionZone = { position, size ->
                        activeZonePosition = position
                        activeZoneSize = size
                    },
                    zoneType = DragZone.ACTIVE
                )
            }

            // Inactive zone (right)
            Box(modifier = Modifier.weight(1f)) {
                DragZoneSection(
                    title = "Inactive",
                    items = inactiveItems,
                    columns = columns,
                    draggedItemId = draggedItemId,
                    dragOffset = dragOffset,
                    onDragStart = { id -> draggedItemId = id },
                    onDrag = { offset -> dragOffset += offset },
                    onDragEnd = {
                        handleDragEnd(
                            draggedItemId = draggedItemId,
                            dragOffset = dragOffset,
                            items = items,
                            itemPositions = itemPositions,
                            itemSizes = itemSizes,
                            activeZonePosition = activeZonePosition,
                            activeZoneSize = activeZoneSize,
                            inactiveZonePosition = inactiveZonePosition,
                            inactiveZoneSize = inactiveZoneSize,
                            onReorder = onReorder
                        )
                        draggedItemId = null
                        dragOffset = Offset.Zero
                    },
                    onPositionItem = { id, position, size ->
                        itemPositions[id] = position
                        itemSizes[id] = size
                    },
                    onPositionZone = { position, size ->
                        inactiveZonePosition = position
                        inactiveZoneSize = size
                    },
                    zoneType = DragZone.INACTIVE
                )
            }
        }
    }
}

/**
 * A single zone section (Active or Inactive) containing a title and a grid of draggable items.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DragZoneSection(
    title: String,
    items: List<DragItem>,
    columns: Int,
    draggedItemId: String?,
    dragOffset: Offset,
    onDragStart: (String) -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onPositionItem: (String, Offset, androidx.compose.ui.geometry.Size) -> Unit,
    onPositionZone: (Offset, androidx.compose.ui.geometry.Size) -> Unit,
    zoneType: DragZone
) {
    val isDropTarget = draggedItemId != null
    val highlightBorder = if (isDropTarget) {
        Modifier.border(
            width = 2.dp,
            color = CwocPrimary.copy(alpha = 0.4f),
            shape = RoundedCornerShape(8.dp)
        )
    } else {
        Modifier.border(
            width = 1.dp,
            color = CwocZoneHeaderBrown.copy(alpha = 0.3f),
            shape = RoundedCornerShape(8.dp)
        )
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .then(highlightBorder)
            .background(
                color = if (zoneType == DragZone.ACTIVE)
                    CwocSurfaceVariant.copy(alpha = 0.5f)
                else
                    Color(0xFFF0E8DC).copy(alpha = 0.5f),
                shape = RoundedCornerShape(8.dp)
            )
            .padding(8.dp)
            .onGloballyPositioned { coordinates ->
                onPositionZone(
                    coordinates.positionInRoot(),
                    androidx.compose.ui.geometry.Size(
                        coordinates.size.width.toFloat(),
                        coordinates.size.height.toFloat()
                    )
                )
            }
    ) {
        // Zone title
        Text(
            text = title,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = CwocZoneHeaderBrown,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        if (items.isEmpty()) {
            // Empty zone placeholder
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .background(
                        color = Color(0xFFE8DCC8).copy(alpha = 0.5f),
                        shape = RoundedCornerShape(6.dp)
                    )
                    .border(
                        width = 1.dp,
                        color = CwocZoneHeaderBrown.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(6.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (zoneType == DragZone.ACTIVE) "Drag items here" else "No inactive items",
                    fontSize = 12.sp,
                    color = CwocZoneHeaderBrown.copy(alpha = 0.5f)
                )
            }
        } else {
            // Grid of draggable items
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                maxItemsInEachRow = columns
            ) {
                items.forEach { item ->
                    DragGridItem(
                        item = item,
                        isDragging = item.id == draggedItemId,
                        dragOffset = if (item.id == draggedItemId) dragOffset else Offset.Zero,
                        onDragStart = { onDragStart(item.id) },
                        onDrag = onDrag,
                        onDragEnd = onDragEnd,
                        onPositioned = { position, size ->
                            onPositionItem(item.id, position, size)
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
                // Fill remaining slots with spacers to maintain grid alignment
                val remainder = items.size % columns
                if (remainder != 0) {
                    repeat(columns - remainder) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/**
 * A single draggable item cell in the grid.
 * Supports long-press to initiate drag.
 */
@Composable
private fun DragGridItem(
    item: DragItem,
    isDragging: Boolean,
    dragOffset: Offset,
    onDragStart: () -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onPositioned: (Offset, androidx.compose.ui.geometry.Size) -> Unit,
    modifier: Modifier = Modifier
) {
    val elevation by animateDpAsState(
        targetValue = if (isDragging) 8.dp else 1.dp,
        label = "dragElevation"
    )

    val bgColor = if (item.zone == DragZone.ACTIVE) {
        Color(0xFFFFFAF0)
    } else {
        Color(0xFFF5EDE0)
    }

    Box(
        modifier = modifier
            .then(
                if (isDragging) {
                    Modifier
                        .offset {
                            IntOffset(
                                dragOffset.x.roundToInt(),
                                dragOffset.y.roundToInt()
                            )
                        }
                        .zIndex(10f)
                } else {
                    Modifier.zIndex(0f)
                }
            )
            .shadow(elevation, RoundedCornerShape(6.dp))
            .background(bgColor, RoundedCornerShape(6.dp))
            .border(
                width = 1.dp,
                color = if (isDragging) CwocPrimary else CwocZoneHeaderBrown.copy(alpha = 0.4f),
                shape = RoundedCornerShape(6.dp)
            )
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .onGloballyPositioned { coordinates ->
                onPositioned(
                    coordinates.positionInRoot(),
                    androidx.compose.ui.geometry.Size(
                        coordinates.size.width.toFloat(),
                        coordinates.size.height.toFloat()
                    )
                )
            }
            .pointerInput(item.id) {
                detectDragGesturesAfterLongPress(
                    onDragStart = { onDragStart() },
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
        Text(
            text = item.label,
            fontSize = 13.sp,
            fontWeight = if (item.zone == DragZone.ACTIVE) FontWeight.Medium else FontWeight.Normal,
            color = if (item.zone == DragZone.ACTIVE) CwocZoneHeaderBrown else CwocZoneHeaderBrown.copy(alpha = 0.6f),
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Handles the end of a drag gesture by determining where the item was dropped
 * and computing the new item list.
 *
 * Logic:
 * - If dropped over the Inactive zone, move item to INACTIVE.
 * - If dropped over the Active zone, move item to ACTIVE and insert at the
 *   position of the item it was dropped closest to.
 * - If dropped over a specific item in the Active zone, swap/insert at that position.
 */
private fun handleDragEnd(
    draggedItemId: String?,
    dragOffset: Offset,
    items: List<DragItem>,
    itemPositions: Map<String, Offset>,
    itemSizes: Map<String, androidx.compose.ui.geometry.Size>,
    activeZonePosition: Offset,
    activeZoneSize: androidx.compose.ui.geometry.Size,
    inactiveZonePosition: Offset,
    inactiveZoneSize: androidx.compose.ui.geometry.Size,
    onReorder: (List<DragItem>) -> Unit
) {
    if (draggedItemId == null) return

    val draggedItem = items.find { it.id == draggedItemId } ?: return
    val draggedPosition = itemPositions[draggedItemId] ?: return

    // Calculate the center of the dragged item at its current position
    val draggedSize = itemSizes[draggedItemId] ?: return
    val dropCenter = Offset(
        draggedPosition.x + dragOffset.x + draggedSize.width / 2f,
        draggedPosition.y + dragOffset.y + draggedSize.height / 2f
    )

    // Determine which zone the drop landed in
    val inActiveZone = isPointInRect(dropCenter, activeZonePosition, activeZoneSize)
    val inInactiveZone = isPointInRect(dropCenter, inactiveZonePosition, inactiveZoneSize)

    val newItems = items.toMutableList()

    when {
        inInactiveZone && draggedItem.zone == DragZone.ACTIVE -> {
            // Move from Active to Inactive
            val index = newItems.indexOfFirst { it.id == draggedItemId }
            if (index >= 0) {
                newItems[index] = draggedItem.copy(zone = DragZone.INACTIVE)
            }
            onReorder(newItems)
        }

        inActiveZone && draggedItem.zone == DragZone.INACTIVE -> {
            // Move from Inactive to Active — add at end of active items
            val index = newItems.indexOfFirst { it.id == draggedItemId }
            if (index >= 0) {
                newItems[index] = draggedItem.copy(zone = DragZone.ACTIVE)
                // Move to end of active items
                val updatedItem = newItems.removeAt(index)
                val lastActiveIndex = newItems.indexOfLast { it.zone == DragZone.ACTIVE }
                newItems.add(lastActiveIndex + 1, updatedItem)
            }
            onReorder(newItems)
        }

        inActiveZone && draggedItem.zone == DragZone.ACTIVE -> {
            // Reorder within Active zone — find closest active item to drop point
            val activeItems = newItems.filter { it.zone == DragZone.ACTIVE && it.id != draggedItemId }
            var closestId: String? = null
            var closestDist = Float.MAX_VALUE

            for (activeItem in activeItems) {
                val pos = itemPositions[activeItem.id] ?: continue
                val size = itemSizes[activeItem.id] ?: continue
                val center = Offset(pos.x + size.width / 2f, pos.y + size.height / 2f)
                val dist = (dropCenter - center).getDistance()
                if (dist < closestDist) {
                    closestDist = dist
                    closestId = activeItem.id
                }
            }

            if (closestId != null) {
                // Remove dragged item and insert at closest item's position
                val dragIndex = newItems.indexOfFirst { it.id == draggedItemId }
                val targetIndex = newItems.indexOfFirst { it.id == closestId }
                if (dragIndex >= 0 && targetIndex >= 0 && dragIndex != targetIndex) {
                    val removed = newItems.removeAt(dragIndex)
                    val adjustedTarget = if (dragIndex < targetIndex) targetIndex - 1 else targetIndex
                    newItems.add(adjustedTarget, removed)
                }
            }
            onReorder(newItems)
        }

        else -> {
            // Dropped outside both zones or no meaningful change — still call onReorder
            // to signal drag completion (no-op)
            onReorder(items)
        }
    }
}

/**
 * Checks if a point is within a rectangle defined by position and size.
 */
private fun isPointInRect(
    point: Offset,
    rectPosition: Offset,
    rectSize: androidx.compose.ui.geometry.Size
): Boolean {
    return point.x >= rectPosition.x &&
            point.x <= rectPosition.x + rectSize.width &&
            point.y >= rectPosition.y &&
            point.y <= rectPosition.y + rectSize.height
}
