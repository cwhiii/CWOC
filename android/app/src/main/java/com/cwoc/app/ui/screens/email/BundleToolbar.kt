package com.cwoc.app.ui.screens.email

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.remote.BundleDto
import kotlin.math.roundToInt

/**
 * Two-row sticky toolbar for the email list view.
 *
 * Row 1: Bulk actions bar (delegated to [BulkActionsBar]).
 * Row 2: Bundle tabs from API with colors, count badges, priority arrows,
 *         and dimmed state when not viewing inbox.
 *
 * Handles:
 * - Bundle tab selection (tap)
 * - Drag-to-reorder (long-press + drag)
 * - Long-press context menu (500ms, via [BundleContextMenu])
 *
 * Validates: Requirements 19.1-19.5, 20.1-20.5, 21.1-21.2, 23.1-23.4, 26.1-26.2
 *
 * @param bundleViewModel The [BundleViewModel] providing bundle state and actions.
 * @param currentFolder The currently selected email folder (e.g., "inbox", "sent").
 * @param isMultiPlacement Whether multi-placement is enabled (hides priority arrows when true).
 * @param isMultiSelectMode Whether multi-select mode is active (for BulkActionsBar).
 * @param selectedCount Number of currently selected emails.
 * @param totalCount Total number of visible emails.
 * @param onSelectAll Callback for Select All action.
 * @param onDeselectAll Callback for Deselect All action.
 * @param onArchiveSelected Callback for bulk archive action.
 * @param onTagSelected Callback for bulk tag action.
 * @param onToggleReadSelected Callback for bulk read/unread toggle.
 * @param onDeleteSelected Callback for bulk delete action.
 * @param onEditBundle Callback when Edit is selected from context menu.
 * @param modifier Optional modifier.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BundleToolbar(
    bundleViewModel: BundleViewModel,
    currentFolder: String,
    isMultiPlacement: Boolean,
    isMultiSelectMode: Boolean,
    selectedCount: Int,
    totalCount: Int,
    onSelectAll: () -> Unit,
    onDeselectAll: () -> Unit,
    onArchiveSelected: () -> Unit,
    onTagSelected: () -> Unit,
    onToggleReadSelected: () -> Unit,
    onDeleteSelected: () -> Unit,
    onEditBundle: (BundleDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val bundleState by bundleViewModel.uiState.collectAsState()
    val isInbox = currentFolder.equals("inbox", ignoreCase = true)
    val toolbarAlpha = if (isInbox) 1f else 0.4f

    Surface(
        modifier = modifier.fillMaxWidth(),
        shadowElevation = 2.dp,
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // ─── Row 1: Bulk Actions Bar ─────────────────────────────────────
            BulkActionsBar(
                selectedCount = selectedCount,
                totalCount = totalCount,
                isMultiSelectMode = isMultiSelectMode,
                onSelectAll = onSelectAll,
                onDeselectAll = onDeselectAll,
                onArchive = onArchiveSelected,
                onTag = onTagSelected,
                onToggleRead = onToggleReadSelected,
                onDelete = onDeleteSelected
            )

            // ─── Row 2: Bundle Tabs ──────────────────────────────────────────
            BundleTabsRow(
                bundles = bundleState.bundles,
                selectedBundleId = bundleState.selectedBundleId,
                isMultiPlacement = isMultiPlacement,
                isInbox = isInbox,
                toolbarAlpha = toolbarAlpha,
                contextMenuBundleId = bundleState.contextMenuBundleId,
                isReordering = bundleState.isReordering,
                onSelectBundle = { bundleId ->
                    if (isInbox) bundleViewModel.selectBundle(bundleId)
                },
                onShowContextMenu = { bundleId ->
                    if (isInbox) bundleViewModel.showContextMenu(bundleId)
                },
                onDismissContextMenu = { bundleViewModel.dismissContextMenu() },
                onEditBundle = onEditBundle,
                onDisableBundle = { id -> bundleViewModel.disableBundle(id) },
                onDeleteBundle = { id -> bundleViewModel.deleteBundle(id) },
                onReorder = { orderedIds -> bundleViewModel.reorderBundles(orderedIds) },
                onStartReordering = { bundleViewModel.startReordering() },
                onStopReordering = { bundleViewModel.stopReordering() },
                formatCount = { unread, total ->
                    bundleViewModel.formatBundleCount(unread, total)
                }
            )
        }
    }
}

/**
 * Horizontally scrollable row of bundle tab chips.
 * Includes an "All" tab at the start, followed by API-loaded bundle tabs.
 * Shows priority arrows between tabs when multi-placement is disabled.
 * Supports drag-to-reorder and long-press context menu.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BundleTabsRow(
    bundles: List<BundleDto>,
    selectedBundleId: String?,
    isMultiPlacement: Boolean,
    isInbox: Boolean,
    toolbarAlpha: Float,
    contextMenuBundleId: String?,
    isReordering: Boolean,
    onSelectBundle: (String?) -> Unit,
    onShowContextMenu: (String) -> Unit,
    onDismissContextMenu: () -> Unit,
    onEditBundle: (BundleDto) -> Unit,
    onDisableBundle: (String) -> Unit,
    onDeleteBundle: (String) -> Unit,
    onReorder: (List<String>) -> Unit,
    onStartReordering: () -> Unit,
    onStopReordering: () -> Unit,
    formatCount: (Int, Int) -> String
) {
    val scrollState = rememberScrollState()

    // Drag-to-reorder state
    var draggedIndex by remember { mutableIntStateOf(-1) }
    var dragOffsetX by remember { mutableFloatStateOf(0f) }
    var dropTargetIndex by remember { mutableIntStateOf(-1) }
    val tabPositions = remember { mutableMapOf<Int, Float>() }
    val tabWidths = remember { mutableMapOf<Int, Float>() }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(toolbarAlpha)
            .horizontalScroll(scrollState)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // ─── "All" Tab ───────────────────────────────────────────────────
        BundleTabChip(
            label = "All",
            isSelected = selectedBundleId == null,
            color = null,
            countBadge = null,
            enabled = isInbox,
            onClick = { onSelectBundle(null) },
            onLongPress = { /* No context menu for "All" tab */ },
            modifier = Modifier
        )

        // ─── Bundle Tabs ─────────────────────────────────────────────────
        bundles.forEachIndexed { index, bundle ->
            // Priority arrow between tabs (Req 21.1-21.2)
            if (!isMultiPlacement) {
                PriorityArrow()
            }

            // Drop indicator before this tab (during drag)
            if (isReordering && dropTargetIndex == index && draggedIndex != index) {
                DropIndicator()
            }

            val countBadge = formatCount(
                bundle.unreadCount ?: 0,
                bundle.totalCount ?: 0
            )

            Box(
                modifier = Modifier
                    .onGloballyPositioned { coordinates ->
                        tabPositions[index] = coordinates.positionInParent().x
                        tabWidths[index] = coordinates.size.width.toFloat()
                    }
                    .then(
                        if (draggedIndex == index) {
                            Modifier.offset { IntOffset(dragOffsetX.roundToInt(), 0) }
                        } else {
                            Modifier
                        }
                    )
                    .pointerInput(bundle.id, isInbox) {
                        if (!isInbox) return@pointerInput
                        detectDragGesturesAfterLongPress(
                            onDragStart = {
                                draggedIndex = index
                                dragOffsetX = 0f
                                onStartReordering()
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                dragOffsetX += dragAmount.x
                                // Calculate drop target based on current drag position
                                val currentX = (tabPositions[index] ?: 0f) + dragOffsetX
                                dropTargetIndex = calculateDropTarget(
                                    currentX,
                                    tabPositions,
                                    tabWidths,
                                    bundles.size
                                )
                            },
                            onDragEnd = {
                                if (dropTargetIndex >= 0 && dropTargetIndex != draggedIndex) {
                                    val reordered = bundles.toMutableList()
                                    val moved = reordered.removeAt(draggedIndex)
                                    reordered.add(dropTargetIndex, moved)
                                    onReorder(reordered.map { it.id })
                                }
                                draggedIndex = -1
                                dragOffsetX = 0f
                                dropTargetIndex = -1
                                onStopReordering()
                            },
                            onDragCancel = {
                                draggedIndex = -1
                                dragOffsetX = 0f
                                dropTargetIndex = -1
                                onStopReordering()
                            }
                        )
                    }
            ) {
                BundleTabChip(
                    label = bundle.name ?: "Unnamed",
                    isSelected = selectedBundleId == bundle.id,
                    color = bundle.color?.let { parseColor(it) },
                    countBadge = countBadge.ifEmpty { null },
                    enabled = isInbox,
                    onClick = { onSelectBundle(bundle.id) },
                    onLongPress = { onShowContextMenu(bundle.id) },
                    modifier = Modifier
                )

                // Context menu for this bundle tab (Req 22.1)
                if (contextMenuBundleId == bundle.id) {
                    BundleContextMenu(
                        expanded = true,
                        bundle = bundle,
                        onDismiss = onDismissContextMenu,
                        onEdit = { onEditBundle(bundle) },
                        onDisable = { onDisableBundle(bundle.id) },
                        onDelete = { onDeleteBundle(bundle.id) }
                    )
                }
            }
        }

        // Drop indicator after last tab (during drag)
        if (isReordering && dropTargetIndex == bundles.size) {
            DropIndicator()
        }
    }
}

/**
 * A single bundle tab chip with optional color background and count badge.
 * Supports tap (select) and long-press (context menu, 500ms).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BundleTabChip(
    label: String,
    isSelected: Boolean,
    color: Color?,
    countBadge: String?,
    enabled: Boolean,
    onClick: () -> Unit,
    onLongPress: () -> Unit,
    modifier: Modifier = Modifier
) {
    val chipColor = when {
        color != null && isSelected -> color
        color != null -> color.copy(alpha = 0.6f)
        isSelected -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val animatedColor by animateColorAsState(
        targetValue = chipColor,
        label = "bundleTabColor"
    )

    val textColor = when {
        color != null -> {
            // Compute contrast-safe text color for custom background
            val luminance = (0.299 * color.red + 0.587 * color.green + 0.114 * color.blue)
            if (luminance > 0.5) Color.Black else Color.White
        }
        isSelected -> MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Surface(
        modifier = modifier
            .combinedClickable(
                enabled = enabled,
                onClick = onClick,
                onLongClick = onLongPress
            ),
        shape = RoundedCornerShape(16.dp),
        color = animatedColor,
        shadowElevation = if (isSelected) 2.dp else 0.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = label,
                color = textColor,
                fontSize = 13.sp,
                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            // Count badge (Req 20.1-20.4)
            if (countBadge != null) {
                Text(
                    text = countBadge,
                    color = textColor.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

/**
 * Priority arrow indicator shown between bundle tabs when multi-placement is disabled.
 * Indicates the classification priority order (Req 21.1).
 */
@Composable
private fun PriorityArrow() {
    Text(
        text = "→",
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
        fontSize = 12.sp,
        modifier = Modifier.padding(horizontal = 2.dp)
    )
}

/**
 * Visual drop indicator shown during drag-to-reorder to indicate the drop target position.
 * Displays as a vertical colored bar (Req 23.2).
 */
@Composable
private fun DropIndicator() {
    Box(
        modifier = Modifier
            .width(3.dp)
            .height(28.dp)
            .background(
                color = MaterialTheme.colorScheme.primary,
                shape = RoundedCornerShape(1.5.dp)
            )
    )
}

/**
 * Calculates the drop target index based on the current drag position.
 * Compares the dragged item's center X against the midpoints of other tabs.
 */
private fun calculateDropTarget(
    currentX: Float,
    tabPositions: Map<Int, Float>,
    tabWidths: Map<Int, Float>,
    tabCount: Int
): Int {
    for (i in 0 until tabCount) {
        val tabStart = tabPositions[i] ?: continue
        val tabWidth = tabWidths[i] ?: continue
        val tabMidpoint = tabStart + tabWidth / 2f
        if (currentX < tabMidpoint) {
            return i
        }
    }
    return tabCount
}

/**
 * Parses a hex color string (e.g., "#FF5733" or "FF5733") into a Compose [Color].
 * Returns null if the string cannot be parsed.
 */
private fun parseColor(colorStr: String): Color? {
    return try {
        val hex = colorStr.removePrefix("#")
        val colorLong = when (hex.length) {
            6 -> "FF$hex".toLong(16)
            8 -> hex.toLong(16)
            else -> return null
        }
        Color(colorLong)
    } catch (e: Exception) {
        null
    }
}
