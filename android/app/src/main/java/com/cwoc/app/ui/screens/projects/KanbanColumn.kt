package com.cwoc.app.ui.screens.projects

import com.cwoc.app.data.local.entity.ChitEntity

/**
 * Kanban column status values matching the server's chit status field.
 */
enum class KanbanStatus(val displayName: String) {
    TODO("ToDo"),
    IN_PROGRESS("In Progress"),
    BLOCKED("Blocked"),
    COMPLETE("Complete");

    companion object {
        /**
         * Map a status string to a KanbanStatus.
         * Case-insensitive matching with common variations.
         */
        fun fromString(status: String?): KanbanStatus {
            if (status == null) return TODO
            return when (status.lowercase().trim()) {
                "todo", "to do", "to-do" -> TODO
                "in progress", "inprogress", "in-progress" -> IN_PROGRESS
                "blocked" -> BLOCKED
                "complete", "completed", "done" -> COMPLETE
                else -> TODO
            }
        }
    }
}

/**
 * Extension function to convert a chit's status string to a KanbanStatus.
 */
fun String?.toKanbanStatus(): KanbanStatus = KanbanStatus.fromString(this)

/**
 * Group a list of child chits by their Kanban status.
 *
 * @param chits List of child chits to group
 * @return Map of KanbanStatus to list of chits in that column.
 *         All four columns are always present (empty list if no chits match).
 */
fun groupByKanbanStatus(chits: List<ChitEntity>): Map<KanbanStatus, List<ChitEntity>> {
    val grouped = chits.groupBy { it.status.toKanbanStatus() }

    // Ensure all columns exist even if empty
    return KanbanStatus.entries.associateWith { status ->
        grouped[status] ?: emptyList()
    }
}
