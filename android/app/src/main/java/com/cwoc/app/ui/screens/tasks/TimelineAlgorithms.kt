package com.cwoc.app.ui.screens.tasks

import com.cwoc.app.data.local.entity.ChitEntity
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Dependency graph representation with forward and reverse adjacency maps.
 * forward: prereqId → list of dependent IDs (who depends on this node)
 * reverse: dependentId → list of prereq IDs (what this node depends on)
 */
data class DependencyGraph(
    val forward: Map<String, List<String>>,
    val reverse: Map<String, List<String>>
)

/**
 * Position of a node in the timeline canvas.
 * lane: "dated" or "undated" for layoutByDate; "dependency" for layoutByDependency
 */
data class NodePosition(
    val x: Float,
    val y: Float,
    val lane: String
)

/**
 * Represents a single dependency change for undo/redo support.
 */
data class DependencyChange(
    val type: ChangeType,
    val prereqId: String,
    val dependentId: String,
    val timestamp: Long = System.currentTimeMillis()
)

enum class ChangeType { ADD, REMOVE }

enum class TimelineOrderMode { BY_DATE, BY_DEPENDENCY }

/**
 * Pure Kotlin object containing all timeline graph algorithms.
 * No Android dependencies — suitable for direct unit testing.
 */
object TimelineAlgorithms {

    private const val NODE_WIDTH = 120f
    private const val NODE_HEIGHT = 60f
    private const val HORIZONTAL_SPACING = 160f
    private const val VERTICAL_SPACING = 80f
    private const val LANE_GAP = 100f

    /**
     * Build a dependency graph from a list of chits.
     * Uses each chit's `prerequisites` field to construct forward and reverse adjacency maps.
     * Only includes edges where both source and target exist in the provided chit list.
     */
    fun buildGraph(chits: List<ChitEntity>): DependencyGraph {
        val chitIds = chits.map { it.id }.toSet()
        val forward = mutableMapOf<String, MutableList<String>>()
        val reverse = mutableMapOf<String, MutableList<String>>()

        // Initialize empty lists for all chit IDs
        for (id in chitIds) {
            forward[id] = mutableListOf()
            reverse[id] = mutableListOf()
        }

        // Build edges from prerequisites
        for (chit in chits) {
            val prereqs = chit.prerequisites ?: continue
            for (prereqId in prereqs) {
                // Only include edges where both nodes exist in the visible set
                if (prereqId in chitIds) {
                    forward.getOrPut(prereqId) { mutableListOf() }.add(chit.id)
                    reverse.getOrPut(chit.id) { mutableListOf() }.add(prereqId)
                }
            }
        }

        return DependencyGraph(
            forward = forward.mapValues { it.value.toList() },
            reverse = reverse.mapValues { it.value.toList() }
        )
    }

    /**
     * Compute the depth of each node in the dependency graph.
     * Depth = longest path from any root (no prerequisites) to this node.
     * Roots have depth 0.
     */
    fun computeDepths(chits: List<ChitEntity>): Map<String, Int> {
        val graph = buildGraph(chits)
        val depths = mutableMapOf<String, Int>()
        val chitIds = chits.map { it.id }.toSet()

        // Find roots (nodes with no prerequisites in the visible set)
        val roots = chitIds.filter { id ->
            (graph.reverse[id] ?: emptyList()).isEmpty()
        }

        // BFS/topological approach: compute longest path from roots
        // Use iterative approach to handle DAGs correctly
        // For longest path in DAG, process in topological order
        val inDegree = mutableMapOf<String, Int>()
        for (id in chitIds) {
            inDegree[id] = (graph.reverse[id] ?: emptyList()).size
        }

        val queue = ArrayDeque<String>()
        for (id in chitIds) {
            depths[id] = 0
        }

        // Start with roots
        for (root in roots) {
            queue.add(root)
            depths[root] = 0
        }

        // Process in topological order, computing longest path
        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            val currentDepth = depths[current] ?: 0

            for (dependent in (graph.forward[current] ?: emptyList())) {
                val newDepth = currentDepth + 1
                if (newDepth > (depths[dependent] ?: 0)) {
                    depths[dependent] = newDepth
                }
                inDegree[dependent] = (inDegree[dependent] ?: 1) - 1
                if (inDegree[dependent] == 0) {
                    queue.add(dependent)
                }
            }
        }

        return depths
    }

    /**
     * Check if adding an edge from fromId to toId would create a cycle.
     * Returns true if:
     * - fromId == toId (self-loop)
     * - toId can already reach fromId through existing forward edges
     *   (meaning fromId depends on toId, so making toId depend on fromId creates a cycle)
     */
    fun wouldCycle(fromId: String, toId: String, graph: DependencyGraph): Boolean {
        // Self-loop always creates a cycle
        if (fromId == toId) return true

        // Check if toId can reach fromId via forward edges
        // If toId → ... → fromId exists, then adding fromId → toId creates a cycle
        val visited = mutableSetOf<String>()
        val queue = ArrayDeque<String>()
        queue.add(toId)

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (current == fromId) return true
            if (current in visited) continue
            visited.add(current)

            for (next in (graph.forward[current] ?: emptyList())) {
                if (next !in visited) {
                    queue.add(next)
                }
            }
        }

        return false
    }

    /**
     * Compute the critical path — the longest dependency chain from any root to any leaf.
     * Returns the set of node IDs on the longest path.
     * If multiple paths tie for longest, returns one of them.
     */
    fun criticalPath(chits: List<ChitEntity>): Set<String> {
        if (chits.isEmpty()) return emptySet()

        val graph = buildGraph(chits)
        val chitIds = chits.map { it.id }.toSet()

        // Find roots (no prerequisites)
        val roots = chitIds.filter { id ->
            (graph.reverse[id] ?: emptyList()).isEmpty()
        }

        if (roots.isEmpty()) return emptySet()

        // Find longest path using DFS from each root, tracking the actual path
        var longestPath = listOf<String>()

        fun dfs(nodeId: String, currentPath: List<String>) {
            val newPath = currentPath + nodeId
            val dependents = graph.forward[nodeId] ?: emptyList()

            if (dependents.isEmpty()) {
                // Leaf node — check if this is the longest path
                if (newPath.size > longestPath.size) {
                    longestPath = newPath
                }
            } else {
                for (dependent in dependents) {
                    // Avoid revisiting (shouldn't happen in a DAG, but safety check)
                    if (dependent !in currentPath) {
                        dfs(dependent, newPath)
                    }
                }
            }
        }

        for (root in roots) {
            dfs(root, emptyList())
        }

        // If no paths found (all isolated nodes), return the first node
        if (longestPath.isEmpty() && chits.isNotEmpty()) {
            return setOf(chits.first().id)
        }

        return longestPath.toSet()
    }

    /**
     * Layout nodes by date: dated tasks positioned by their effective date on x-axis,
     * undated tasks in a separate lane below.
     *
     * Dated lane: x = proportional to date within the date range, y = stacked vertically
     * Undated lane: x = evenly distributed, y = below the dated lane
     */
    fun layoutByDate(chits: List<ChitEntity>, canvasWidth: Float): Map<String, NodePosition> {
        if (chits.isEmpty()) return emptyMap()

        val positions = mutableMapOf<String, NodePosition>()

        // Separate dated and undated chits
        val dated = chits.filter { getEffectiveDate(it) != null }
        val undated = chits.filter { getEffectiveDate(it) == null }

        // Layout dated chits
        if (dated.isNotEmpty()) {
            val dates = dated.mapNotNull { getEffectiveDate(it) }
            val minDate = dates.min()
            val maxDate = dates.max()
            val dateRange = ChronoUnit.DAYS.between(minDate, maxDate).toFloat().coerceAtLeast(1f)

            // Usable width with padding
            val padding = NODE_WIDTH
            val usableWidth = (canvasWidth - 2 * padding).coerceAtLeast(NODE_WIDTH)

            // Group by date to stack vertically
            val dateGroups = dated.groupBy { getEffectiveDate(it) }
            for ((date, group) in dateGroups) {
                if (date == null) continue
                val dayOffset = ChronoUnit.DAYS.between(minDate, date).toFloat()
                val x = padding + (dayOffset / dateRange) * usableWidth

                for ((index, chit) in group.withIndex()) {
                    val y = VERTICAL_SPACING + index * (NODE_HEIGHT + VERTICAL_SPACING / 2)
                    positions[chit.id] = NodePosition(x = x, y = y, lane = "dated")
                }
            }
        }

        // Layout undated chits in a separate lane below
        if (undated.isNotEmpty()) {
            val datedMaxY = positions.values.maxOfOrNull { it.y + NODE_HEIGHT } ?: 0f
            val undatedStartY = datedMaxY + LANE_GAP

            val padding = NODE_WIDTH
            val usableWidth = (canvasWidth - 2 * padding).coerceAtLeast(NODE_WIDTH)
            val spacing = if (undated.size > 1) {
                usableWidth / (undated.size - 1).toFloat()
            } else {
                0f
            }

            for ((index, chit) in undated.withIndex()) {
                val x = if (undated.size == 1) {
                    canvasWidth / 2f
                } else {
                    padding + index * spacing
                }
                positions[chit.id] = NodePosition(x = x, y = undatedStartY, lane = "undated")
            }
        }

        return positions
    }

    /**
     * Layout nodes by dependency depth: roots at left, leaves at right.
     * Nodes at the same depth are stacked vertically.
     */
    fun layoutByDependency(chits: List<ChitEntity>, canvasWidth: Float): Map<String, NodePosition> {
        if (chits.isEmpty()) return emptyMap()

        val depths = computeDepths(chits)
        val positions = mutableMapOf<String, NodePosition>()

        val maxDepth = depths.values.maxOrNull() ?: 0

        // Usable width with padding
        val padding = NODE_WIDTH
        val usableWidth = (canvasWidth - 2 * padding).coerceAtLeast(NODE_WIDTH)
        val horizontalStep = if (maxDepth > 0) {
            usableWidth / maxDepth.toFloat()
        } else {
            0f
        }

        // Group by depth for vertical stacking
        val depthGroups = chits.groupBy { depths[it.id] ?: 0 }

        for ((depth, group) in depthGroups) {
            val x = padding + depth * horizontalStep

            for ((index, chit) in group.withIndex()) {
                val y = VERTICAL_SPACING + index * (NODE_HEIGHT + VERTICAL_SPACING / 2)
                positions[chit.id] = NodePosition(x = x, y = y, lane = "dependency")
            }
        }

        return positions
    }

    /**
     * Get the immediate neighbors of a node: direct prerequisites + direct dependents.
     * Returns the set of node IDs that are one edge away from the given node.
     */
    fun connectedNodes(nodeId: String, graph: DependencyGraph): Set<String> {
        val prereqs = graph.reverse[nodeId] ?: emptyList()
        val dependents = graph.forward[nodeId] ?: emptyList()
        return (prereqs + dependents).toSet()
    }

    /**
     * Extract the effective date from a chit for timeline positioning.
     * Priority: startDatetime > dueDatetime > endDatetime
     */
    private fun getEffectiveDate(chit: ChitEntity): LocalDate? {
        val dateStr = chit.startDatetime ?: chit.dueDatetime ?: chit.endDatetime ?: return null
        return try {
            // Try ISO datetime format first (e.g., "2024-01-15T10:00:00")
            LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME).toLocalDate()
        } catch (_: Exception) {
            try {
                // Try date-only format (e.g., "2024-01-15")
                LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
            } catch (_: Exception) {
                try {
                    // Try with offset (e.g., "2024-01-15T10:00:00Z" or "2024-01-15T10:00:00+05:00")
                    LocalDateTime.parse(
                        dateStr.substringBefore('Z').substringBefore('+').let {
                            if (it.indexOf('-', startIndex = 11) != -1) it.substringBeforeLast('-') else it
                        },
                        DateTimeFormatter.ISO_LOCAL_DATE_TIME
                    ).toLocalDate()
                } catch (_: Exception) {
                    null
                }
            }
        }
    }
}
