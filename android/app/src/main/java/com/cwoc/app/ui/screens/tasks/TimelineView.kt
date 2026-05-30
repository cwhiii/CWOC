package com.cwoc.app.ui.screens.tasks

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ChitEntity

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Default canvas width used for layout computation (logical pixels). */
private const val DEFAULT_CANVAS_WIDTH = 1200f

/** Controls bar background color. */
private val ControlsBarBg = Color(0xFFFAF3E8)

// ─── TimelineView Composable ────────────────────────────────────────────────────

/**
 * Top-level timeline composable that assembles all timeline sub-components:
 * - TimelineControlsBar (link mode, order toggle, critical path, undo/redo)
 * - TimelineCanvas (zoom/pan, dependency lines, drag preview)
 * - TimelineNode (individual task nodes positioned absolutely)
 * - TimelineZoomControls (zoom in/out/recenter at bottom-right)
 * - TimelineContextMenu (long-press menu)
 * - LinkModeToastEffect (toast feedback for link mode)
 *
 * Computes node positions using TimelineAlgorithms.layoutByDate() or layoutByDependency()
 * based on the current timelineOrderMode.
 *
 * Wires all interactions:
 * - Node tap: if linkMode → handleLinkModeTap(), else → viewModel.highlightNode()
 * - Node double-tap: navigate to editor (onOpenEditor callback)
 * - Node long-press: show context menu
 * - Drag-to-link: startDragLink, updateDragLinkPosition, completeDragLink/cancelDragLink
 * - Tap on empty space: viewModel.clearHighlight()
 *
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5
 *
 * @param tasks List of task chits to display in the timeline
 * @param onOpenEditor Callback to navigate to the chit editor for a given chit ID
 * @param viewModel The TasksViewModel managing all timeline state
 */
@Composable
fun TimelineView(
    tasks: List<ChitEntity>,
    onOpenEditor: (String) -> Unit,
    viewModel: TasksViewModel
) {
    val context = LocalContext.current
    val density = LocalDensity.current

    // ── Collect ViewModel state ──────────────────────────────────────────

    val zoom by viewModel.timelineZoom.collectAsState()
    val offset by viewModel.timelineOffset.collectAsState()
    val orderMode by viewModel.timelineOrderMode.collectAsState()
    val highlightedNodes by viewModel.highlightedNodes.collectAsState()
    val linkMode by viewModel.linkMode.collectAsState()
    val linkSource by viewModel.linkSource.collectAsState()
    val criticalPathActive by viewModel.criticalPathActive.collectAsState()
    val criticalPathNodes by viewModel.criticalPathNodes.collectAsState()
    val greyOutCompleted by viewModel.greyOutCompleted.collectAsState()
    val dragLinkState by viewModel.dragLinkState.collectAsState()

    // ── Compute dependency graph and node positions ──────────────────────

    val graph = remember(tasks) {
        TimelineAlgorithms.buildGraph(tasks)
    }

    val nodePositions = remember(tasks, orderMode) {
        when (orderMode) {
            TimelineOrderMode.BY_DATE -> TimelineAlgorithms.layoutByDate(tasks, DEFAULT_CANVAS_WIDTH)
            TimelineOrderMode.BY_DEPENDENCY -> TimelineAlgorithms.layoutByDependency(tasks, DEFAULT_CANVAS_WIDTH)
        }
    }

    // ── Context menu state ───────────────────────────────────────────────

    var contextMenuChit by remember { mutableStateOf<ChitEntity?>(null) }
    var contextMenuExpanded by remember { mutableStateOf(false) }

    // ── Link Mode toast effect ───────────────────────────────────────────

    LinkModeToastEffect(linkMode = linkMode, linkSource = linkSource)

    // ── Layout ───────────────────────────────────────────────────────────

    Column(modifier = Modifier.fillMaxSize()) {
        // Controls bar at the top
        TimelineControlsBar(
            viewModel = viewModel,
            modifier = Modifier
                .fillMaxWidth()
                .background(ControlsBarBg)
        )

        // Main timeline area (canvas + nodes + zoom controls)
        Box(modifier = Modifier.fillMaxSize()) {
            // Timeline canvas with zoom/pan and dependency lines
            TimelineCanvas(
                zoom = zoom,
                offset = offset,
                nodePositions = nodePositions,
                graph = graph,
                highlightedNodes = highlightedNodes,
                criticalPathNodes = criticalPathNodes,
                dragLinkState = dragLinkState,
                onZoomChange = { newZoom ->
                    viewModel.timelineZoom.value = newZoom
                },
                onOffsetChange = { newOffset ->
                    viewModel.timelineOffset.value = newOffset
                },
                onTapEmptySpace = {
                    viewModel.clearHighlight()
                }
            ) {
                // Render TimelineNode composables positioned absolutely via Modifier.offset
                for (task in tasks) {
                    val position = nodePositions[task.id] ?: continue

                    val isHighlighted = task.id in highlightedNodes
                    val isCriticalPath = task.id in criticalPathNodes
                    val isGreyedOut = greyOutCompleted && task.status == "Complete"
                    val isLinkSourceNode = linkSource == task.id

                    // Disable drag-to-link when in Link Mode (use tap-based linking instead)
                    val dragEnabled = !linkMode

                    Box(
                        modifier = Modifier.offset {
                            IntOffset(position.x.toInt(), position.y.toInt())
                        }
                    ) {
                        TimelineNode(
                            chit = task,
                            isHighlighted = isHighlighted,
                            isCriticalPath = isCriticalPath,
                            isGreyedOut = isGreyedOut,
                            isLinkSource = isLinkSourceNode,
                            dragToLinkEnabled = dragEnabled,
                            onTap = {
                                if (linkMode) {
                                    // Link Mode: handle source/target tap
                                    handleLinkModeTap(
                                        tappedNodeId = task.id,
                                        viewModel = viewModel,
                                        onCycleDetected = {
                                            Toast.makeText(
                                                context,
                                                "Cannot create circular dependency",
                                                Toast.LENGTH_SHORT
                                            ).show()
                                        },
                                        onLinkCreated = {
                                            Toast.makeText(
                                                context,
                                                "Dependency created",
                                                Toast.LENGTH_SHORT
                                            ).show()
                                        }
                                    )
                                } else {
                                    // Normal mode: highlight node and connected neighbors
                                    viewModel.highlightNode(task.id)
                                }
                            },
                            onDoubleTap = {
                                // Navigate to chit editor
                                onOpenEditor(task.id)
                            },
                            onLongPress = {
                                // Show context menu
                                contextMenuChit = task
                                contextMenuExpanded = true
                            },
                            onDragLinkStart = { startOffset ->
                                // Convert node-local offset to canvas-space position
                                val canvasPosition = Offset(
                                    x = position.x + startOffset.x,
                                    y = position.y + startOffset.y
                                )
                                viewModel.startDragLink(task.id, canvasPosition)
                            },
                            onDragLinkMove = { moveOffset ->
                                // Convert node-local offset to canvas-space position
                                val canvasPosition = Offset(
                                    x = position.x + moveOffset.x,
                                    y = position.y + moveOffset.y
                                )
                                viewModel.updateDragLinkPosition(canvasPosition)
                            },
                            onDragLinkEnd = { endOffset ->
                                // Convert node-local offset to canvas-space position
                                val canvasPosition = Offset(
                                    x = position.x + endOffset.x,
                                    y = position.y + endOffset.y
                                )
                                // Hit test to find target node
                                val targetNodeId = hitTestNode(
                                    touchPosition = canvasPosition,
                                    nodePositions = nodePositions,
                                    excludeNodeId = task.id,
                                    density = density.density
                                )
                                if (targetNodeId != null) {
                                    // Dropped on a valid target — create dependency
                                    viewModel.completeDragLink(targetNodeId) { result ->
                                        when (result) {
                                            TasksViewModel.AddDependencyResult.SUCCESS -> {
                                                Toast.makeText(
                                                    context,
                                                    "Dependency created",
                                                    Toast.LENGTH_SHORT
                                                ).show()
                                            }
                                            TasksViewModel.AddDependencyResult.CYCLE_DETECTED -> {
                                                Toast.makeText(
                                                    context,
                                                    "Cannot create circular dependency",
                                                    Toast.LENGTH_SHORT
                                                ).show()
                                            }
                                            TasksViewModel.AddDependencyResult.ALREADY_EXISTS -> {
                                                Toast.makeText(
                                                    context,
                                                    "Dependency already exists",
                                                    Toast.LENGTH_SHORT
                                                ).show()
                                            }
                                            TasksViewModel.AddDependencyResult.NOT_FOUND -> {
                                                Toast.makeText(
                                                    context,
                                                    "Task not found",
                                                    Toast.LENGTH_SHORT
                                                ).show()
                                            }
                                        }
                                    }
                                } else {
                                    // Dropped on empty space — cancel
                                    viewModel.cancelDragLink()
                                }
                            }
                        )
                    }
                }
            }

            // Zoom controls positioned at bottom-right
            TimelineZoomControls(
                viewModel = viewModel,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
            )

            // Context menu (shown on long-press of a node)
            if (contextMenuExpanded && contextMenuChit != null) {
                TimelineContextMenu(
                    expanded = contextMenuExpanded,
                    onDismiss = {
                        contextMenuExpanded = false
                        contextMenuChit = null
                    },
                    chit = contextMenuChit!!,
                    allTasks = tasks,
                    onAddDependency = {
                        // Enter Link Mode with this node as source
                        viewModel.linkMode.value = true
                        viewModel.linkSource.value = contextMenuChit!!.id
                    },
                    onRemoveDependency = { prereqId, dependentId ->
                        viewModel.removeDependency(prereqId, dependentId)
                    },
                    onOpenInEditor = {
                        onOpenEditor(contextMenuChit!!.id)
                    }
                )
            }
        }
    }
}
