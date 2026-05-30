package com.cwoc.app.ui.screens.tasks

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Parchment brown used for default button state. */
private val ParchmentBrown = Color(0xFF6B4E31)

/** Highlighted teal color when Link Mode is active. */
private val LinkModeActiveColor = Color(0xFF008080)

/** Highlighted orange color when Critical Path is active. */
private val CriticalPathActiveColor = Color(0xFFD84315)

/** Light parchment background for inactive button. */
private val ButtonBgInactive = Color(0xFFFFF8F0)

/** Highlighted background when Link Mode is active. */
private val ButtonBgActive = Color(0xFFE0F2F1)

/** Highlighted background when Critical Path is active. */
private val CriticalPathBgActive = Color(0xFFFBE9E7)

/** Controls bar background. */
private val ControlsBarBg = Color(0xFFFAF3E8)

// ─── TimelineControlsBar Composable ─────────────────────────────────────────────

/**
 * Controls bar for the timeline view containing toggle buttons for Link Mode,
 * order toggle, critical path, undo/redo, and grey-out completed.
 *
 * Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5, 28.1, 29.1, 29.2, 29.3, 29.4, 30.1, 30.2, 30.3, 30.4
 */
@Composable
fun TimelineControlsBar(
    viewModel: TasksViewModel,
    modifier: Modifier = Modifier
) {
    val linkMode by viewModel.linkMode.collectAsState()
    val linkSource by viewModel.linkSource.collectAsState()
    val orderMode by viewModel.timelineOrderMode.collectAsState()
    val criticalPathActive by viewModel.criticalPathActive.collectAsState()

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp)
            .padding(horizontal = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Link Mode toggle button
        TimelineLinkModeButton(
            isActive = linkMode,
            hasSource = linkSource != null,
            onToggle = {
                if (linkMode) {
                    // Re-tap cancels Link Mode
                    viewModel.linkMode.value = false
                    viewModel.linkSource.value = null
                } else {
                    // Activate Link Mode
                    viewModel.linkMode.value = true
                    viewModel.linkSource.value = null
                }
            }
        )

        // Order toggle button (By Date / By Dependency)
        TimelineOrderToggleButton(
            currentMode = orderMode,
            onToggle = {
                val newMode = if (orderMode == TimelineOrderMode.BY_DATE) {
                    TimelineOrderMode.BY_DEPENDENCY
                } else {
                    TimelineOrderMode.BY_DATE
                }
                viewModel.setTimelineOrderMode(newMode)
            }
        )

        // Critical Path toggle button
        TimelineCriticalPathButton(
            isActive = criticalPathActive,
            onToggle = {
                viewModel.criticalPathActive.value = !criticalPathActive
            }
        )

        // Undo/Redo buttons for dependency changes
        TimelineUndoRedoButtons(viewModel = viewModel)
    }

    // Back press handler: cancel Link Mode when active
    BackHandler(enabled = linkMode) {
        viewModel.linkMode.value = false
        viewModel.linkSource.value = null
    }
}

// ─── TimelineLinkModeButton Composable ──────────────────────────────────────────

/**
 * Toggle button for Link Mode in the timeline controls bar.
 *
 * Visual states:
 * - Inactive: parchment brown border, light background
 * - Active (no source selected): teal border + background highlight, "Tap source node" hint
 * - Active (source selected): teal border + background, "Tap target node" hint
 *
 * Validates: Requirements 27.1, 27.2
 */
@Composable
fun TimelineLinkModeButton(
    isActive: Boolean,
    hasSource: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    val borderColor = if (isActive) LinkModeActiveColor else ParchmentBrown
    val bgColor = if (isActive) ButtonBgActive else ButtonBgInactive
    val contentColor = if (isActive) LinkModeActiveColor else ParchmentBrown

    Surface(
        onClick = onToggle,
        modifier = modifier.height(36.dp),
        shape = RoundedCornerShape(8.dp),
        color = bgColor,
        border = BorderStroke(
            width = if (isActive) 2.dp else 1.dp,
            color = borderColor
        ),
        shadowElevation = if (isActive) 2.dp else 0.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Link,
                contentDescription = if (isActive) "Cancel Link Mode" else "Enter Link Mode",
                tint = contentColor,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = when {
                    isActive && hasSource -> "Tap target"
                    isActive -> "Tap source"
                    else -> "Link"
                },
                color = contentColor,
                fontSize = 12.sp,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}

// ─── TimelineOrderToggleButton Composable ───────────────────────────────────────

/**
 * Toggle button for switching between "By Date" and "By Dependency" layout modes.
 *
 * Visual states:
 * - BY_DATE: shows calendar icon + "By Date" label
 * - BY_DEPENDENCY: shows tree icon + "By Deps" label
 *
 * The button always shows the CURRENT mode. Tapping switches to the other mode.
 *
 * Validates: Requirements 28.1, 28.4
 */
@Composable
fun TimelineOrderToggleButton(
    currentMode: TimelineOrderMode,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isByDependency = currentMode == TimelineOrderMode.BY_DEPENDENCY
    val icon = if (isByDependency) Icons.Default.AccountTree else Icons.Default.CalendarMonth
    val label = if (isByDependency) "By Deps" else "By Date"
    val contentDescription = if (isByDependency) "Switch to By Date layout" else "Switch to By Dependency layout"

    Surface(
        onClick = onToggle,
        modifier = modifier.height(36.dp),
        shape = RoundedCornerShape(8.dp),
        color = ButtonBgInactive,
        border = BorderStroke(
            width = 1.dp,
            color = ParchmentBrown
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = ParchmentBrown,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = label,
                color = ParchmentBrown,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

// ─── TimelineCriticalPathButton Composable ──────────────────────────────────────

/**
 * Toggle button for Critical Path highlighting in the timeline controls bar.
 *
 * Visual states:
 * - Inactive: parchment brown border, light background, "Critical" label
 * - Active: deep orange border + background highlight, bold "Critical" label
 *
 * When activated, the TimelineView computes the longest dependency chain via
 * TimelineAlgorithms.criticalPath() and highlights all nodes and lines on that path.
 * When deactivated, the critical path highlighting is removed.
 *
 * Validates: Requirements 29.1, 29.2, 29.3, 29.4
 */
@Composable
fun TimelineCriticalPathButton(
    isActive: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    val borderColor = if (isActive) CriticalPathActiveColor else ParchmentBrown
    val bgColor = if (isActive) CriticalPathBgActive else ButtonBgInactive
    val contentColor = if (isActive) CriticalPathActiveColor else ParchmentBrown

    Surface(
        onClick = onToggle,
        modifier = modifier.height(36.dp),
        shape = RoundedCornerShape(8.dp),
        color = bgColor,
        border = BorderStroke(
            width = if (isActive) 2.dp else 1.dp,
            color = borderColor
        ),
        shadowElevation = if (isActive) 2.dp else 0.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.TrendingUp,
                contentDescription = if (isActive) "Deactivate Critical Path" else "Activate Critical Path",
                tint = contentColor,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = "Critical",
                color = contentColor,
                fontSize = 12.sp,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}

// ─── TimelineUndoRedoButtons Composable ─────────────────────────────────────────

/**
 * Undo and Redo buttons for reversing/re-applying dependency changes in the timeline.
 *
 * - Undo button is disabled when undoStack is empty.
 * - Redo button is disabled when redoStack is empty.
 * - Undo stack is limited to 50 entries (enforced in TasksViewModel).
 *
 * Validates: Requirements 30.1, 30.2, 30.3, 30.4
 */
@Composable
fun TimelineUndoRedoButtons(
    viewModel: TasksViewModel,
    modifier: Modifier = Modifier
) {
    val undoStack by viewModel.undoStack.collectAsState()
    val redoStack by viewModel.redoStack.collectAsState()

    val undoEnabled = undoStack.isNotEmpty()
    val redoEnabled = redoStack.isNotEmpty()

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Undo button
        Surface(
            onClick = { viewModel.undo() },
            enabled = undoEnabled,
            modifier = Modifier.height(36.dp),
            shape = RoundedCornerShape(8.dp),
            color = ButtonBgInactive,
            border = BorderStroke(
                width = 1.dp,
                color = if (undoEnabled) ParchmentBrown else ParchmentBrown.copy(alpha = 0.3f)
            )
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Undo,
                    contentDescription = "Undo dependency change",
                    tint = if (undoEnabled) ParchmentBrown else ParchmentBrown.copy(alpha = 0.3f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        // Redo button
        Surface(
            onClick = { viewModel.redo() },
            enabled = redoEnabled,
            modifier = Modifier.height(36.dp),
            shape = RoundedCornerShape(8.dp),
            color = ButtonBgInactive,
            border = BorderStroke(
                width = 1.dp,
                color = if (redoEnabled) ParchmentBrown else ParchmentBrown.copy(alpha = 0.3f)
            )
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Redo,
                    contentDescription = "Redo dependency change",
                    tint = if (redoEnabled) ParchmentBrown else ParchmentBrown.copy(alpha = 0.3f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

// ─── Link Mode Interaction Logic ────────────────────────────────────────────────

/**
 * Handles a node tap when Link Mode is active.
 * Call this from the timeline view's node tap handler when linkMode is true.
 *
 * Flow:
 * 1. If no source is set → record tapped node as source (highlight it)
 * 2. If source is set and tapped node is different → create dependency and exit Link Mode
 * 3. If source is set and tapped node is the same → deselect source (cancel)
 *
 * @param tappedNodeId The ID of the node that was tapped
 * @param viewModel The TasksViewModel managing link mode state
 * @param onCycleDetected Callback invoked when a circular dependency would be created
 * @param onLinkCreated Callback invoked when a dependency is successfully created
 *
 * Validates: Requirements 27.3, 27.4, 27.5
 */
fun handleLinkModeTap(
    tappedNodeId: String,
    viewModel: TasksViewModel,
    onCycleDetected: () -> Unit = {},
    onLinkCreated: () -> Unit = {}
) {
    val currentSource = viewModel.linkSource.value

    if (currentSource == null) {
        // First tap: record source node
        viewModel.linkSource.value = tappedNodeId
    } else if (currentSource == tappedNodeId) {
        // Tapped same node again: deselect source
        viewModel.linkSource.value = null
    } else {
        // Second tap on different node: create dependency
        // source = prerequisite, tapped = dependent
        val tasks = viewModel.uiState.value.tasks
        val graph = TimelineAlgorithms.buildGraph(tasks)

        if (TimelineAlgorithms.wouldCycle(currentSource, tappedNodeId, graph)) {
            // Cycle detected — notify caller
            onCycleDetected()
        } else {
            // Create the dependency
            viewModel.addDependency(currentSource, tappedNodeId)
            onLinkCreated()
        }

        // Exit Link Mode regardless of success/failure
        viewModel.linkMode.value = false
        viewModel.linkSource.value = null
    }
}

// ─── Link Mode Toast Effect ─────────────────────────────────────────────────────

/**
 * Composable effect that shows a toast when Link Mode is activated.
 * Place this in the timeline view composable to provide user feedback.
 *
 * Validates: Requirements 27.2
 */
@Composable
fun LinkModeToastEffect(
    linkMode: Boolean,
    linkSource: String?
) {
    val context = LocalContext.current

    LaunchedEffect(linkMode, linkSource) {
        if (linkMode && linkSource == null) {
            Toast.makeText(context, "Link Mode: Tap source node, then target node", Toast.LENGTH_SHORT).show()
        } else if (linkMode && linkSource != null) {
            Toast.makeText(context, "Now tap the target node", Toast.LENGTH_SHORT).show()
        }
    }
}
