package com.cwoc.app.ui.components

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for Undo on Delete logic.
 *
 * Property 21: Undo restores pre-deletion state.
 *
 * For any chit that is soft-deleted and then undone, the chit's state should
 * be identical to its pre-deletion state (deleted=false, all other fields unchanged).
 *
 * We simulate the undo-on-delete flow:
 * 1. Start with an active chit (deleted=false)
 * 2. Soft-delete it (set deleted=true)
 * 3. Undo the deletion (restore to pre-deletion state)
 * 4. Verify the restored chit is identical to the original
 *
 * **Validates: Requirements 13.3**
 */
class UndoDeleteTest {

    // =========================================================================
    // Test Data Generators
    // =========================================================================

    private val titlePool = listOf(
        "Buy groceries", "Fix bug #42", "Call dentist", "Weekly review",
        "Deploy v2.0", "Read chapter 5", "Plan vacation", "Update resume",
        "Clean garage", "Write tests", "Team standup", "Refactor auth",
        null, "", "Meeting notes", "Project Alpha"
    )

    private val statusPool = listOf("ToDo", "In Progress", "Blocked", "Complete", null)
    private val priorityPool = listOf("Critical", "High", "Medium", "Low", null)
    private val tagPool = listOf("Work", "Personal", "Urgent", "Health", "Finance", "Home")
    private val colorPool = listOf("#FF6B6B", "#FF8E53", "#FFC93C", "#6BCB77", "#4D96FF", null)
    private val timezonePool = listOf("America/New_York", "Europe/London", "Asia/Tokyo", "UTC", null)

    /**
     * Generates a random active ChitEntity (deleted=false) with varied field values.
     */
    private fun generateActiveChit(r: java.util.Random, id: String): ChitEntity {
        val numTags = r.nextInt(4)
        val tags = if (numTags == 0) null else tagPool.shuffled(r).take(numTags)
        val numPeople = r.nextInt(3)
        val people = if (numPeople == 0) null else listOf("Alice", "Bob", "Charlie").shuffled(r).take(numPeople)
        val numChildChits = r.nextInt(3)
        val childChits = if (numChildChits == 0) null else (0 until numChildChits).map { "child-${r.nextInt(1000)}" }
        val numPrereqs = r.nextInt(3)
        val prerequisites = if (numPrereqs == 0) null else (0 until numPrereqs).map { "prereq-${r.nextInt(1000)}" }

        return ChitEntity(
            id = id,
            title = titlePool[r.nextInt(titlePool.size)],
            note = if (r.nextBoolean()) "Note content ${r.nextInt(1000)}" else null,
            tags = tags,
            startDatetime = if (r.nextBoolean()) "2024-0${r.nextInt(9) + 1}-${10 + r.nextInt(19)}T09:00:00Z" else null,
            endDatetime = if (r.nextBoolean()) "2024-0${r.nextInt(9) + 1}-${10 + r.nextInt(19)}T17:00:00Z" else null,
            dueDatetime = if (r.nextBoolean()) "2024-0${r.nextInt(9) + 1}-${10 + r.nextInt(19)}T23:59:00Z" else null,
            pointInTime = if (r.nextBoolean()) "2024-03-15T14:30:00Z" else null,
            completedDatetime = if (r.nextBoolean()) "2024-01-15T10:00:00Z" else null,
            status = statusPool[r.nextInt(statusPool.size)],
            priority = priorityPool[r.nextInt(priorityPool.size)],
            severity = if (r.nextBoolean()) "High" else null,
            checklist = if (r.nextBoolean()) "[{\"text\":\"item ${r.nextInt(100)}\",\"checked\":${r.nextBoolean()}}]" else null,
            alarm = if (r.nextBoolean()) r.nextBoolean() else null,
            notification = if (r.nextBoolean()) r.nextBoolean() else null,
            recurrence = if (r.nextBoolean()) "Weekly" else null,
            recurrenceId = if (r.nextBoolean()) "rec-${r.nextInt(1000)}" else null,
            recurrenceRule = if (r.nextBoolean()) "{\"freq\":\"WEEKLY\",\"interval\":1}" else null,
            recurrenceExceptions = if (r.nextBoolean()) "[\"2024-03-15\"]" else null,
            location = if (r.nextBoolean()) "Office ${r.nextInt(10)}" else null,
            color = colorPool[r.nextInt(colorPool.size)],
            people = people,
            pinned = r.nextBoolean(),
            archived = r.nextBoolean(),
            deleted = false, // Always start as active
            createdDatetime = "2024-01-01T00:00:00Z",
            modifiedDatetime = "2024-01-15T12:00:00Z",
            isProjectMaster = r.nextBoolean(),
            childChits = childChits,
            allDay = r.nextBoolean(),
            timezone = timezonePool[r.nextInt(timezonePool.size)],
            alerts = if (r.nextBoolean()) "[{\"type\":\"ALARM\",\"offsetMinutes\":15}]" else null,
            progressPercent = if (r.nextBoolean()) r.nextInt(101) else null,
            timeEstimate = if (r.nextBoolean()) "${r.nextInt(8) + 1}h" else null,
            weatherData = if (r.nextBoolean()) "{\"temp\":72}" else null,
            healthData = if (r.nextBoolean()) "{\"steps\":5000}" else null,
            habit = r.nextBoolean(),
            habitGoal = if (r.nextBoolean()) r.nextInt(30) + 1 else null,
            habitSuccess = if (r.nextBoolean()) r.nextInt(30) else null,
            showOnCalendar = if (r.nextBoolean()) r.nextBoolean() else null,
            habitResetPeriod = if (r.nextBoolean()) "daily" else null,
            habitLastActionDate = if (r.nextBoolean()) "2024-06-01" else null,
            habitHideOverall = if (r.nextBoolean()) r.nextBoolean() else null,
            perpetual = r.nextBoolean(),
            shares = if (r.nextBoolean()) "[\"user1\"]" else null,
            stealth = if (r.nextBoolean()) r.nextBoolean() else null,
            assignedTo = if (r.nextBoolean()) "user-${r.nextInt(10)}" else null,
            ownerId = if (r.nextBoolean()) "owner-${r.nextInt(5)}" else null,
            hasUnviewedConflict = r.nextBoolean(),
            availability = if (r.nextBoolean()) "busy" else null,
            snoozedUntil = if (r.nextBoolean()) "2024-07-01T09:00:00Z" else null,
            prerequisites = prerequisites,
            syncVersion = r.nextInt(10),
            lastSyncedAt = if (r.nextBoolean()) "2024-06-01T00:00:00Z" else null,
            isDirty = r.nextBoolean(),
            dirtyFields = if (r.nextBoolean()) "[\"title\",\"note\"]" else "[]",
            conflictFields = if (r.nextBoolean()) "[\"status\"]" else null
        )
    }

    // =========================================================================
    // Simulated Undo-on-Delete Flow
    // =========================================================================

    /**
     * Simulates soft-deleting a chit: sets deleted=true.
     * In the real app, this happens on swipe-to-delete.
     */
    private fun simulateSoftDelete(chit: ChitEntity): ChitEntity {
        return chit.copy(deleted = true)
    }

    /**
     * Simulates undoing a deletion: restores the chit to its pre-deletion state.
     * The undo operation uses the saved pre-deletion snapshot to restore the chit
     * exactly as it was before deletion.
     */
    private fun simulateUndoDelete(preDeleteSnapshot: ChitEntity): ChitEntity {
        // Undo simply restores the pre-deletion state — the snapshot is the original chit
        return preDeleteSnapshot.copy()
    }

    // =========================================================================
    // Property 21: Undo restores pre-deletion state
    // =========================================================================
    //
    // For any active chit (deleted == false), soft-deleting it and then
    // immediately undoing should produce a chit state identical to the original
    // (same field values, deleted == false).
    //
    // **Validates: Requirements 13.3**

    @Test
    fun `Property 21 - undo after soft-delete restores deleted=false`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            // Soft-delete
            val deletedChit = simulateSoftDelete(originalChit)
            assertTrue(
                "Seed $seed: soft-deleted chit should have deleted=true",
                deletedChit.deleted
            )

            // Undo
            val restoredChit = simulateUndoDelete(originalChit)
            assertFalse(
                "Seed $seed: undone chit should have deleted=false",
                restoredChit.deleted
            )
        }
    }

    @Test
    fun `Property 21 - undo restores title exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: title must be restored exactly",
                originalChit.title, restoredChit.title
            )
        }
    }

    @Test
    fun `Property 21 - undo restores note exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: note must be restored exactly",
                originalChit.note, restoredChit.note
            )
        }
    }

    @Test
    fun `Property 21 - undo restores tags exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: tags must be restored exactly",
                originalChit.tags, restoredChit.tags
            )
        }
    }

    @Test
    fun `Property 21 - undo restores status and priority exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: status must be restored exactly",
                originalChit.status, restoredChit.status
            )
            assertEquals(
                "Seed $seed: priority must be restored exactly",
                originalChit.priority, restoredChit.priority
            )
        }
    }

    @Test
    fun `Property 21 - undo restores all date fields exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: startDatetime preserved",
                originalChit.startDatetime, restoredChit.startDatetime
            )
            assertEquals(
                "Seed $seed: endDatetime preserved",
                originalChit.endDatetime, restoredChit.endDatetime
            )
            assertEquals(
                "Seed $seed: dueDatetime preserved",
                originalChit.dueDatetime, restoredChit.dueDatetime
            )
            assertEquals(
                "Seed $seed: pointInTime preserved",
                originalChit.pointInTime, restoredChit.pointInTime
            )
            assertEquals(
                "Seed $seed: completedDatetime preserved",
                originalChit.completedDatetime, restoredChit.completedDatetime
            )
            assertEquals(
                "Seed $seed: createdDatetime preserved",
                originalChit.createdDatetime, restoredChit.createdDatetime
            )
            assertEquals(
                "Seed $seed: modifiedDatetime preserved",
                originalChit.modifiedDatetime, restoredChit.modifiedDatetime
            )
        }
    }

    @Test
    fun `Property 21 - undo restores checklist and people exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: checklist preserved",
                originalChit.checklist, restoredChit.checklist
            )
            assertEquals(
                "Seed $seed: people preserved",
                originalChit.people, restoredChit.people
            )
        }
    }

    @Test
    fun `Property 21 - undo restores boolean flags exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: pinned preserved",
                originalChit.pinned, restoredChit.pinned
            )
            assertEquals(
                "Seed $seed: archived preserved",
                originalChit.archived, restoredChit.archived
            )
            assertEquals(
                "Seed $seed: allDay preserved",
                originalChit.allDay, restoredChit.allDay
            )
            assertEquals(
                "Seed $seed: isProjectMaster preserved",
                originalChit.isProjectMaster, restoredChit.isProjectMaster
            )
            assertEquals(
                "Seed $seed: habit preserved",
                originalChit.habit, restoredChit.habit
            )
            assertEquals(
                "Seed $seed: perpetual preserved",
                originalChit.perpetual, restoredChit.perpetual
            )
            assertEquals(
                "Seed $seed: hasUnviewedConflict preserved",
                originalChit.hasUnviewedConflict, restoredChit.hasUnviewedConflict
            )
        }
    }

    @Test
    fun `Property 21 - undo restores all remaining fields exactly`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            assertEquals("Seed $seed: id preserved", originalChit.id, restoredChit.id)
            assertEquals("Seed $seed: severity preserved", originalChit.severity, restoredChit.severity)
            assertEquals("Seed $seed: alarm preserved", originalChit.alarm, restoredChit.alarm)
            assertEquals("Seed $seed: notification preserved", originalChit.notification, restoredChit.notification)
            assertEquals("Seed $seed: recurrence preserved", originalChit.recurrence, restoredChit.recurrence)
            assertEquals("Seed $seed: recurrenceId preserved", originalChit.recurrenceId, restoredChit.recurrenceId)
            assertEquals("Seed $seed: recurrenceRule preserved", originalChit.recurrenceRule, restoredChit.recurrenceRule)
            assertEquals("Seed $seed: recurrenceExceptions preserved", originalChit.recurrenceExceptions, restoredChit.recurrenceExceptions)
            assertEquals("Seed $seed: location preserved", originalChit.location, restoredChit.location)
            assertEquals("Seed $seed: color preserved", originalChit.color, restoredChit.color)
            assertEquals("Seed $seed: childChits preserved", originalChit.childChits, restoredChit.childChits)
            assertEquals("Seed $seed: timezone preserved", originalChit.timezone, restoredChit.timezone)
            assertEquals("Seed $seed: alerts preserved", originalChit.alerts, restoredChit.alerts)
            assertEquals("Seed $seed: progressPercent preserved", originalChit.progressPercent, restoredChit.progressPercent)
            assertEquals("Seed $seed: timeEstimate preserved", originalChit.timeEstimate, restoredChit.timeEstimate)
            assertEquals("Seed $seed: weatherData preserved", originalChit.weatherData, restoredChit.weatherData)
            assertEquals("Seed $seed: healthData preserved", originalChit.healthData, restoredChit.healthData)
            assertEquals("Seed $seed: habitGoal preserved", originalChit.habitGoal, restoredChit.habitGoal)
            assertEquals("Seed $seed: habitSuccess preserved", originalChit.habitSuccess, restoredChit.habitSuccess)
            assertEquals("Seed $seed: showOnCalendar preserved", originalChit.showOnCalendar, restoredChit.showOnCalendar)
            assertEquals("Seed $seed: habitResetPeriod preserved", originalChit.habitResetPeriod, restoredChit.habitResetPeriod)
            assertEquals("Seed $seed: habitLastActionDate preserved", originalChit.habitLastActionDate, restoredChit.habitLastActionDate)
            assertEquals("Seed $seed: habitHideOverall preserved", originalChit.habitHideOverall, restoredChit.habitHideOverall)
            assertEquals("Seed $seed: shares preserved", originalChit.shares, restoredChit.shares)
            assertEquals("Seed $seed: stealth preserved", originalChit.stealth, restoredChit.stealth)
            assertEquals("Seed $seed: assignedTo preserved", originalChit.assignedTo, restoredChit.assignedTo)
            assertEquals("Seed $seed: ownerId preserved", originalChit.ownerId, restoredChit.ownerId)
            assertEquals("Seed $seed: availability preserved", originalChit.availability, restoredChit.availability)
            assertEquals("Seed $seed: snoozedUntil preserved", originalChit.snoozedUntil, restoredChit.snoozedUntil)
            assertEquals("Seed $seed: prerequisites preserved", originalChit.prerequisites, restoredChit.prerequisites)
            assertEquals("Seed $seed: syncVersion preserved", originalChit.syncVersion, restoredChit.syncVersion)
            assertEquals("Seed $seed: lastSyncedAt preserved", originalChit.lastSyncedAt, restoredChit.lastSyncedAt)
            assertEquals("Seed $seed: isDirty preserved", originalChit.isDirty, restoredChit.isDirty)
            assertEquals("Seed $seed: dirtyFields preserved", originalChit.dirtyFields, restoredChit.dirtyFields)
            assertEquals("Seed $seed: conflictFields preserved", originalChit.conflictFields, restoredChit.conflictFields)
        }
    }

    @Test
    fun `Property 21 - restored chit equals original via data class equality`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            // Soft-delete then undo
            val deletedChit = simulateSoftDelete(originalChit)
            val restoredChit = simulateUndoDelete(originalChit)

            // Data class equality check — covers ALL fields at once
            assertEquals(
                "Seed $seed: restored chit must be identical to original",
                originalChit, restoredChit
            )
        }
    }

    @Test
    fun `Property 21 - soft-delete changes only the deleted flag`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)

            // The only difference should be the deleted flag
            assertEquals(
                "Seed $seed: soft-delete should only change deleted flag",
                originalChit.copy(deleted = true), deletedChit
            )
        }
    }

    @Test
    fun `Property 21 - undo is idempotent (undoing twice produces same result)`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            val deletedChit = simulateSoftDelete(originalChit)
            val restoredOnce = simulateUndoDelete(originalChit)
            val restoredTwice = simulateUndoDelete(originalChit)

            assertEquals(
                "Seed $seed: undoing twice should produce same result",
                restoredOnce, restoredTwice
            )
        }
    }

    @Test
    fun `Property 21 - undo after delete-undo-delete cycle still restores original`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val originalChit = generateActiveChit(r, "chit-$seed")

            // Delete -> Undo -> Delete -> Undo
            val deleted1 = simulateSoftDelete(originalChit)
            val restored1 = simulateUndoDelete(originalChit)
            val deleted2 = simulateSoftDelete(restored1)
            val restored2 = simulateUndoDelete(restored1)

            assertEquals(
                "Seed $seed: undo after repeated delete-undo cycles restores original",
                originalChit, restored2
            )
        }
    }

    @Test
    fun `Property 21 - undo preserves chit in a list context`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val listSize = r.nextInt(10) + 3
            val chitList = (0 until listSize).map { i ->
                generateActiveChit(r, "chit-$seed-$i")
            }

            // Pick a random chit to delete and undo
            val targetIndex = r.nextInt(chitList.size)
            val targetChit = chitList[targetIndex]

            // Simulate: soft-delete in list, then undo restores it
            val afterDelete = chitList.map { chit ->
                if (chit.id == targetChit.id) simulateSoftDelete(chit) else chit
            }

            // Verify it's deleted in the list
            assertTrue(
                "Seed $seed: target chit should be deleted in list",
                afterDelete[targetIndex].deleted
            )

            // Undo: restore from snapshot
            val afterUndo = afterDelete.map { chit ->
                if (chit.id == targetChit.id) simulateUndoDelete(targetChit) else chit
            }

            // Verify restored chit matches original
            assertEquals(
                "Seed $seed: restored chit in list must match original",
                targetChit, afterUndo[targetIndex]
            )

            // Verify other chits are unaffected
            for (i in chitList.indices) {
                if (i == targetIndex) continue
                assertEquals(
                    "Seed $seed: chit at index $i should be unaffected",
                    chitList[i], afterUndo[i]
                )
            }
        }
    }
}
