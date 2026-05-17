package com.cwoc.app.ui.components.swipe

import com.cwoc.app.data.local.entity.ChitEntity

/**
 * Types of swipe actions available on chit list items.
 */
enum class SwipeActionType {
    ARCHIVE,    // Right swipe — mark as Complete
    SNOOZE      // Left swipe — set a reminder
}

/**
 * Result of applying a swipe action, containing the previous state for undo.
 */
data class SwipeActionResult(
    val chitId: String,
    val actionType: SwipeActionType,
    val previousStatus: String?,
    val previousAlerts: String?,
    val previousIsDirty: Boolean,
    val previousDirtyFields: String?
)

/**
 * Pure functions for applying and undoing swipe actions on chits.
 */
object SwipeActions {

    /**
     * Apply an archive action: sets status to "Complete".
     * Returns the SwipeActionResult for undo, and the updated entity fields.
     */
    fun applyArchive(chit: ChitEntity): Pair<SwipeActionResult, ChitEntity> {
        val result = SwipeActionResult(
            chitId = chit.id,
            actionType = SwipeActionType.ARCHIVE,
            previousStatus = chit.status,
            previousAlerts = chit.alerts,
            previousIsDirty = chit.isDirty,
            previousDirtyFields = chit.dirtyFields
        )

        val updated = chit.copy(
            status = "Complete",
            completedDatetime = java.time.Instant.now().toString(),
            isDirty = true
        )

        return Pair(result, updated)
    }

    /**
     * Apply a snooze action: sets snoozedUntil to the given datetime.
     * Returns the SwipeActionResult for undo, and the updated entity fields.
     */
    fun applySnooze(chit: ChitEntity, snoozeUntil: String): Pair<SwipeActionResult, ChitEntity> {
        val result = SwipeActionResult(
            chitId = chit.id,
            actionType = SwipeActionType.SNOOZE,
            previousStatus = chit.status,
            previousAlerts = chit.alerts,
            previousIsDirty = chit.isDirty,
            previousDirtyFields = chit.dirtyFields
        )

        val updated = chit.copy(
            snoozedUntil = snoozeUntil,
            isDirty = true
        )

        return Pair(result, updated)
    }

    /**
     * Undo a swipe action by restoring the previous state.
     * Returns the entity restored to its pre-swipe state.
     */
    fun undoSwipeAction(chit: ChitEntity, result: SwipeActionResult): ChitEntity {
        return when (result.actionType) {
            SwipeActionType.ARCHIVE -> chit.copy(
                status = result.previousStatus,
                completedDatetime = null,
                isDirty = result.previousIsDirty,
                dirtyFields = result.previousDirtyFields
            )
            SwipeActionType.SNOOZE -> chit.copy(
                snoozedUntil = null,
                isDirty = result.previousIsDirty,
                dirtyFields = result.previousDirtyFields
            )
        }
    }
}
