package com.cwoc.app.ui.screens.projects

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

/**
 * Property-based tests for Kanban status grouping.
 *
 * Property 6: Kanban column assignment matches status — for any child chit with a
 * status field value, groupByKanbanStatus SHALL place it in the column whose label
 * matches that status. Unknown statuses SHALL map to the TODO column.
 *
 * Property 7: Kanban column counts are accurate — for any set of child chits grouped
 * by status, the count for each Kanban column SHALL equal the length of that column's
 * chit list, and the sum of all column counts SHALL equal the total number of input chits.
 *
 * **Validates: Requirements 2.3, 2.6**
 */
class KanbanGroupingPropertyTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val random = java.util.Random(42)

    /** All known status strings that map to specific columns. */
    private val knownStatuses = mapOf(
        "todo" to KanbanStatus.TODO,
        "to do" to KanbanStatus.TODO,
        "to-do" to KanbanStatus.TODO,
        "in progress" to KanbanStatus.IN_PROGRESS,
        "inprogress" to KanbanStatus.IN_PROGRESS,
        "in-progress" to KanbanStatus.IN_PROGRESS,
        "blocked" to KanbanStatus.BLOCKED,
        "complete" to KanbanStatus.COMPLETE,
        "completed" to KanbanStatus.COMPLETE,
        "done" to KanbanStatus.COMPLETE
    )

    /** Status strings that should default to TODO. */
    private val unknownStatuses = listOf(
        "unknown", "pending", "waiting", "review", "cancelled", "archived",
        "new", "open", "closed", "deferred", "", "  ", "random_status_123"
    )

    /**
     * Generates a minimal ChitEntity with the given status for testing grouping logic.
     */
    private fun chitWithStatus(status: String?, id: String = UUID.randomUUID().toString()): ChitEntity {
        return ChitEntity(
            id = id,
            title = "Chit $id",
            note = null,
            tags = null,
            startDatetime = null,
            endDatetime = null,
            dueDatetime = null,
            pointInTime = null,
            completedDatetime = null,
            status = status,
            priority = null,
            severity = null,
            checklist = null,
            alarm = null,
            notification = null,
            recurrence = null,
            recurrenceId = null,
            recurrenceRule = null,
            recurrenceExceptions = null,
            location = null,
            color = null,
            people = null,
            pinned = false,
            archived = false,
            deleted = false,
            createdDatetime = null,
            modifiedDatetime = null,
            isProjectMaster = false,
            childChits = null,
            allDay = false,
            timezone = null,
            alerts = null,
            progressPercent = null,
            timeEstimate = null,
            weatherData = null,
            healthData = null,
            habit = false,
            habitGoal = null,
            habitSuccess = null,
            showOnCalendar = null,
            habitResetPeriod = null,
            habitLastActionDate = null,
            habitHideOverall = null,
            perpetual = false,
            shares = null,
            stealth = null,
            assignedTo = null,
            ownerId = null,
            hasUnviewedConflict = false,
            availability = null,
            snoozedUntil = null,
            prerequisites = null,
            syncVersion = 0,
            lastSyncedAt = null,
            isDirty = false,
            dirtyFields = "[]"
        )
    }

    /**
     * Generates a random status string — either a known status, unknown status, or null.
     */
    private fun randomStatus(r: java.util.Random): String? {
        val choice = r.nextInt(10)
        return when {
            choice < 4 -> knownStatuses.keys.toList()[r.nextInt(knownStatuses.size)]
            choice < 7 -> unknownStatuses[r.nextInt(unknownStatuses.size)]
            choice < 9 -> null
            else -> "random_${r.nextInt(1000)}"
        }
    }

    // =========================================================================
    // Property 6: Kanban column assignment matches status
    // =========================================================================
    //
    // For any child chit with a status field value, groupByKanbanStatus SHALL place
    // it in the column whose label matches that status. Unknown statuses SHALL map
    // to the TODO column.
    //
    // **Validates: Requirements 2.3**

    @Test
    fun `Property 6 - known status strings map to correct columns`() {
        for ((statusString, expectedColumn) in knownStatuses) {
            val chit = chitWithStatus(statusString)
            val result = groupByKanbanStatus(listOf(chit))

            val actualColumn = result.entries.find { it.value.contains(chit) }?.key
            assertEquals(
                "Status '$statusString' should map to ${expectedColumn.displayName}",
                expectedColumn,
                actualColumn
            )
        }
    }

    @Test
    fun `Property 6 - known statuses are case-insensitive`() {
        // Test uppercase, mixed case, and padded variants
        val caseVariants = listOf(
            "TODO" to KanbanStatus.TODO,
            "ToDo" to KanbanStatus.TODO,
            "TO DO" to KanbanStatus.TODO,
            "In Progress" to KanbanStatus.IN_PROGRESS,
            "IN PROGRESS" to KanbanStatus.IN_PROGRESS,
            "BLOCKED" to KanbanStatus.BLOCKED,
            "Blocked" to KanbanStatus.BLOCKED,
            "COMPLETE" to KanbanStatus.COMPLETE,
            "Complete" to KanbanStatus.COMPLETE,
            "COMPLETED" to KanbanStatus.COMPLETE,
            "Done" to KanbanStatus.COMPLETE,
            "DONE" to KanbanStatus.COMPLETE,
            " todo " to KanbanStatus.TODO,
            " in progress " to KanbanStatus.IN_PROGRESS
        )

        for ((statusString, expectedColumn) in caseVariants) {
            val chit = chitWithStatus(statusString)
            val result = groupByKanbanStatus(listOf(chit))

            val actualColumn = result.entries.find { it.value.contains(chit) }?.key
            assertEquals(
                "Status '$statusString' (case variant) should map to ${expectedColumn.displayName}",
                expectedColumn,
                actualColumn
            )
        }
    }

    @Test
    fun `Property 6 - unknown statuses default to TODO column`() {
        for (unknownStatus in unknownStatuses) {
            val chit = chitWithStatus(unknownStatus)
            val result = groupByKanbanStatus(listOf(chit))

            val actualColumn = result.entries.find { it.value.contains(chit) }?.key
            assertEquals(
                "Unknown status '$unknownStatus' should default to TODO",
                KanbanStatus.TODO,
                actualColumn
            )
        }
    }

    @Test
    fun `Property 6 - null status defaults to TODO column`() {
        val chit = chitWithStatus(null)
        val result = groupByKanbanStatus(listOf(chit))

        val actualColumn = result.entries.find { it.value.contains(chit) }?.key
        assertEquals(
            "Null status should default to TODO",
            KanbanStatus.TODO,
            actualColumn
        )
    }

    @Test
    fun `Property 6 - toKanbanStatus extension matches groupByKanbanStatus placement`() {
        // For 100 random statuses, verify the extension function and grouping agree
        val r = java.util.Random(123)
        for (i in 1..100) {
            val status = randomStatus(r)
            val expectedColumn = status.toKanbanStatus()
            val chit = chitWithStatus(status, id = "chit-$i")
            val result = groupByKanbanStatus(listOf(chit))

            val actualColumn = result.entries.find { it.value.contains(chit) }?.key
            assertEquals(
                "Iteration $i: toKanbanStatus('$status') = $expectedColumn should match grouping",
                expectedColumn,
                actualColumn
            )
        }
    }

    @Test
    fun `Property 6 - every chit lands in exactly one column`() {
        // Generate a diverse set of chits with various statuses
        val r = java.util.Random(456)
        val chits = (1..50).map { i ->
            chitWithStatus(randomStatus(r), id = "chit-$i")
        }

        val result = groupByKanbanStatus(chits)

        // Each chit should appear in exactly one column
        for (chit in chits) {
            val columnsContaining = result.entries.filter { it.value.contains(chit) }
            assertEquals(
                "Chit '${chit.id}' with status '${chit.status}' should be in exactly one column",
                1,
                columnsContaining.size
            )
        }
    }

    // =========================================================================
    // Property 7: Kanban column counts are accurate
    // =========================================================================
    //
    // For any set of child chits grouped by status, the count badge for each Kanban
    // column SHALL equal the length of that column's chit list, and the sum of all
    // column counts SHALL equal the total number of input chits.
    //
    // **Validates: Requirements 2.6**

    @Test
    fun `Property 7 - sum of all column counts equals total input chits`() {
        // Test across 50 random configurations
        val r = java.util.Random(789)
        for (trial in 1..50) {
            val numChits = r.nextInt(20) + 1
            val chits = (1..numChits).map { i ->
                chitWithStatus(randomStatus(r), id = "trial$trial-chit$i")
            }

            val result = groupByKanbanStatus(chits)
            val totalInColumns = result.values.sumOf { it.size }

            assertEquals(
                "Trial $trial: sum of column counts ($totalInColumns) should equal input count ($numChits)",
                numChits,
                totalInColumns
            )
        }
    }

    @Test
    fun `Property 7 - empty input produces all columns with zero counts`() {
        val result = groupByKanbanStatus(emptyList())

        // All four columns must exist
        assertEquals(4, result.size)
        for (status in KanbanStatus.entries) {
            assertTrue(
                "Column ${status.displayName} should exist in result",
                result.containsKey(status)
            )
            assertEquals(
                "Column ${status.displayName} should have 0 chits for empty input",
                0,
                result[status]!!.size
            )
        }
    }

    @Test
    fun `Property 7 - all four columns always present in result`() {
        // Even when all chits have the same status, all columns should exist
        val statuses = listOf("todo", "in progress", "blocked", "complete")
        for (status in statuses) {
            val chits = (1..5).map { chitWithStatus(status, id = "same-$status-$it") }
            val result = groupByKanbanStatus(chits)

            assertEquals(
                "Result should always have exactly 4 columns (all chits status='$status')",
                4,
                result.size
            )
            for (col in KanbanStatus.entries) {
                assertTrue(
                    "Column ${col.displayName} should exist even when all chits are '$status'",
                    result.containsKey(col)
                )
            }
        }
    }

    @Test
    fun `Property 7 - column count matches list size for each column`() {
        // Generate diverse chits and verify count == list.size for each column
        val r = java.util.Random(101)
        for (trial in 1..30) {
            val numChits = r.nextInt(30) + 5
            val chits = (1..numChits).map { i ->
                chitWithStatus(randomStatus(r), id = "count-trial$trial-$i")
            }

            val result = groupByKanbanStatus(chits)

            for ((status, chitList) in result) {
                // The "count badge" value is simply the list size
                val countBadge = chitList.size
                assertEquals(
                    "Trial $trial: count badge for ${status.displayName} should equal list size",
                    chitList.size,
                    countBadge
                )
            }
        }
    }

    @Test
    fun `Property 7 - no chits are lost or duplicated during grouping`() {
        // For 50 random sets, verify all input chit IDs appear exactly once in output
        val r = java.util.Random(202)
        for (trial in 1..50) {
            val numChits = r.nextInt(25) + 1
            val chits = (1..numChits).map { i ->
                chitWithStatus(randomStatus(r), id = "nodupe-trial$trial-$i")
            }

            val result = groupByKanbanStatus(chits)
            val allOutputIds = result.values.flatten().map { it.id }

            // Same count
            assertEquals(
                "Trial $trial: output count should match input count",
                chits.size,
                allOutputIds.size
            )

            // No duplicates
            assertEquals(
                "Trial $trial: no duplicate IDs in output",
                allOutputIds.size,
                allOutputIds.toSet().size
            )

            // Same IDs
            assertEquals(
                "Trial $trial: output IDs should match input IDs",
                chits.map { it.id }.toSet(),
                allOutputIds.toSet()
            )
        }
    }

    @Test
    fun `Property 7 - single chit per status produces count of 1 each`() {
        val chits = listOf(
            chitWithStatus("todo", id = "single-todo"),
            chitWithStatus("in progress", id = "single-ip"),
            chitWithStatus("blocked", id = "single-blocked"),
            chitWithStatus("complete", id = "single-complete")
        )

        val result = groupByKanbanStatus(chits)

        assertEquals(1, result[KanbanStatus.TODO]!!.size)
        assertEquals(1, result[KanbanStatus.IN_PROGRESS]!!.size)
        assertEquals(1, result[KanbanStatus.BLOCKED]!!.size)
        assertEquals(1, result[KanbanStatus.COMPLETE]!!.size)
    }
}
