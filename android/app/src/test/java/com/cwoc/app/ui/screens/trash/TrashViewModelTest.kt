package com.cwoc.app.ui.screens.trash

import com.cwoc.app.data.local.entity.ChitEntity
import org.junit.Assert.*
import org.junit.Test

/**
 * Property-based tests for Trash query and restore logic.
 *
 * Property 18: Trash query returns only deleted chits
 * Property 19: Trash restore clears deleted flag
 *
 * Since we can't easily test the ViewModel with real Room in unit tests,
 * we test the core logic by simulating the DAO behavior:
 * - Trash query: filter chits where deleted == true
 * - Restore: set deleted = false on a chit
 *
 * **Validates: Requirements 11.2, 11.3**
 */
class TrashViewModelTest {

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

    /**
     * Generates a random ChitEntity with a specified deleted state.
     */
    private fun generateChit(r: java.util.Random, id: String, deleted: Boolean): ChitEntity {
        val numTags = r.nextInt(4)
        val tags = if (numTags == 0) null else tagPool.shuffled(r).take(numTags)

        return ChitEntity(
            id = id,
            title = titlePool[r.nextInt(titlePool.size)],
            note = if (r.nextBoolean()) "Some note content ${r.nextInt(1000)}" else null,
            tags = tags,
            startDatetime = if (r.nextBoolean()) "2024-0${r.nextInt(9) + 1}-${10 + r.nextInt(19)}T09:00:00Z" else null,
            endDatetime = if (r.nextBoolean()) "2024-0${r.nextInt(9) + 1}-${10 + r.nextInt(19)}T17:00:00Z" else null,
            dueDatetime = if (r.nextBoolean()) "2024-0${r.nextInt(9) + 1}-${10 + r.nextInt(19)}T23:59:00Z" else null,
            pointInTime = null,
            completedDatetime = if (r.nextBoolean()) "2024-01-15T10:00:00Z" else null,
            status = statusPool[r.nextInt(statusPool.size)],
            priority = priorityPool[r.nextInt(priorityPool.size)],
            severity = null,
            checklist = if (r.nextBoolean()) "[{\"text\":\"item\",\"checked\":false}]" else null,
            alarm = r.nextBoolean(),
            notification = r.nextBoolean(),
            recurrence = null,
            recurrenceId = null,
            recurrenceRule = null,
            recurrenceExceptions = null,
            location = if (r.nextBoolean()) "Home" else null,
            color = if (r.nextBoolean()) "#FF6B6B" else null,
            people = if (r.nextBoolean()) listOf("Alice", "Bob") else null,
            pinned = r.nextBoolean(),
            archived = r.nextBoolean(),
            deleted = deleted,
            createdDatetime = "2024-01-01T00:00:00Z",
            modifiedDatetime = "2024-01-15T12:00:00Z",
            isProjectMaster = false,
            childChits = null,
            allDay = r.nextBoolean(),
            timezone = if (r.nextBoolean()) "America/New_York" else null,
            alerts = null,
            progressPercent = if (r.nextBoolean()) r.nextInt(101) else null,
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
            syncVersion = r.nextInt(10),
            lastSyncedAt = null,
            isDirty = r.nextBoolean(),
            dirtyFields = "[]",
            conflictFields = null
        )
    }

    /**
     * Generates a mixed list of chits with random deleted states.
     * Returns the full list along with the expected deleted/non-deleted partitions.
     */
    private fun generateMixedChitList(r: java.util.Random, size: Int): List<ChitEntity> {
        return (0 until size).map { i ->
            val deleted = r.nextBoolean()
            generateChit(r, "chit-$i-${r.nextInt(10000)}", deleted)
        }
    }

    // =========================================================================
    // Simulated DAO behavior
    // =========================================================================

    /**
     * Simulates ChitDao.getDeletedChits() — returns only chits where deleted == true.
     * This mirrors the Room query: SELECT * FROM chits WHERE deleted = 1
     */
    private fun simulateTrashQuery(allChits: List<ChitEntity>): List<ChitEntity> {
        return allChits.filter { it.deleted }
    }

    /**
     * Simulates ChitDao.restoreDeleted() — sets deleted=false on the target chit.
     * This mirrors the Room query: UPDATE chits SET deleted = 0, modifiedDatetime = :now WHERE id = :id
     */
    private fun simulateRestore(allChits: List<ChitEntity>, chitId: String, now: String): List<ChitEntity> {
        return allChits.map { chit ->
            if (chit.id == chitId) {
                chit.copy(deleted = false, modifiedDatetime = now)
            } else {
                chit
            }
        }
    }

    /**
     * Simulates ChitDao.getAllNonDeleted() — returns only chits where deleted == false.
     * This mirrors the Room query: SELECT * FROM chits WHERE deleted = 0
     */
    private fun simulateActiveQuery(allChits: List<ChitEntity>): List<ChitEntity> {
        return allChits.filter { !it.deleted }
    }

    // =========================================================================
    // Property 18: Trash query returns only deleted chits
    // =========================================================================
    //
    // For any set of chits with various deleted states, the trash query should
    // return exactly those chits where deleted == true, and no chit with
    // deleted == false should appear in trash results.
    //
    // **Validates: Requirements 11.2**

    @Test
    fun `Property 18 - trash query returns only chits with deleted=true`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(20) + 5 // 5 to 24 chits
            val allChits = generateMixedChitList(r, size)

            val trashResult = simulateTrashQuery(allChits)

            // Every chit in trash result must have deleted == true
            for (chit in trashResult) {
                assertTrue(
                    "Seed $seed: chit '${chit.id}' in trash must have deleted=true",
                    chit.deleted
                )
            }
        }
    }

    @Test
    fun `Property 18 - trash query excludes all non-deleted chits`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(20) + 5
            val allChits = generateMixedChitList(r, size)

            val trashResult = simulateTrashQuery(allChits)
            val trashIds = trashResult.map { it.id }.toSet()

            // No non-deleted chit should appear in trash
            val nonDeletedChits = allChits.filter { !it.deleted }
            for (chit in nonDeletedChits) {
                assertFalse(
                    "Seed $seed: non-deleted chit '${chit.id}' must NOT appear in trash",
                    trashIds.contains(chit.id)
                )
            }
        }
    }

    @Test
    fun `Property 18 - trash query returns ALL deleted chits (completeness)`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(20) + 5
            val allChits = generateMixedChitList(r, size)

            val trashResult = simulateTrashQuery(allChits)
            val expectedDeletedCount = allChits.count { it.deleted }

            assertEquals(
                "Seed $seed: trash should contain exactly all deleted chits",
                expectedDeletedCount, trashResult.size
            )
        }
    }

    @Test
    fun `Property 18 - trash and active queries partition the full set`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(20) + 5
            val allChits = generateMixedChitList(r, size)

            val trashResult = simulateTrashQuery(allChits)
            val activeResult = simulateActiveQuery(allChits)

            // Trash + active should cover all chits (partition property)
            assertEquals(
                "Seed $seed: trash + active should equal total chit count",
                allChits.size, trashResult.size + activeResult.size
            )

            // No overlap between trash and active
            val trashIds = trashResult.map { it.id }.toSet()
            val activeIds = activeResult.map { it.id }.toSet()
            val overlap = trashIds.intersect(activeIds)
            assertTrue(
                "Seed $seed: trash and active should have no overlap, found: $overlap",
                overlap.isEmpty()
            )
        }
    }

    @Test
    fun `Property 18 - empty list produces empty trash`() {
        val trashResult = simulateTrashQuery(emptyList())
        assertTrue("Empty input should produce empty trash", trashResult.isEmpty())
    }

    @Test
    fun `Property 18 - all deleted produces full trash`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(10) + 3
            val allDeleted = (0 until size).map { i ->
                generateChit(r, "del-$i", deleted = true)
            }

            val trashResult = simulateTrashQuery(allDeleted)
            assertEquals(
                "Seed $seed: all-deleted list should produce full trash",
                allDeleted.size, trashResult.size
            )
        }
    }

    @Test
    fun `Property 18 - no deleted produces empty trash`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(10) + 3
            val noneDeleted = (0 until size).map { i ->
                generateChit(r, "active-$i", deleted = false)
            }

            val trashResult = simulateTrashQuery(noneDeleted)
            assertTrue(
                "Seed $seed: no-deleted list should produce empty trash",
                trashResult.isEmpty()
            )
        }
    }

    // =========================================================================
    // Property 19: Trash restore clears deleted flag
    // =========================================================================
    //
    // For any chit in the trash (deleted == true), restoring it should set
    // deleted = false and the chit should subsequently appear in active queries
    // and no longer appear in trash queries.
    //
    // **Validates: Requirements 11.3**

    @Test
    fun `Property 19 - restore sets deleted=false on target chit`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(15) + 5
            val allChits = generateMixedChitList(r, size)

            // Pick a deleted chit to restore
            val deletedChits = allChits.filter { it.deleted }
            if (deletedChits.isEmpty()) continue

            val targetChit = deletedChits[r.nextInt(deletedChits.size)]
            val now = "2024-06-15T10:00:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)
            val restoredChit = afterRestore.first { it.id == targetChit.id }

            assertFalse(
                "Seed $seed: restored chit '${targetChit.id}' should have deleted=false",
                restoredChit.deleted
            )
        }
    }

    @Test
    fun `Property 19 - restored chit no longer appears in trash query`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(15) + 5
            val allChits = generateMixedChitList(r, size)

            val deletedChits = allChits.filter { it.deleted }
            if (deletedChits.isEmpty()) continue

            val targetChit = deletedChits[r.nextInt(deletedChits.size)]
            val now = "2024-06-15T10:00:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)
            val trashAfterRestore = simulateTrashQuery(afterRestore)
            val trashIds = trashAfterRestore.map { it.id }.toSet()

            assertFalse(
                "Seed $seed: restored chit '${targetChit.id}' must NOT appear in trash",
                trashIds.contains(targetChit.id)
            )
        }
    }

    @Test
    fun `Property 19 - restored chit appears in active query`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(15) + 5
            val allChits = generateMixedChitList(r, size)

            val deletedChits = allChits.filter { it.deleted }
            if (deletedChits.isEmpty()) continue

            val targetChit = deletedChits[r.nextInt(deletedChits.size)]
            val now = "2024-06-15T10:00:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)
            val activeAfterRestore = simulateActiveQuery(afterRestore)
            val activeIds = activeAfterRestore.map { it.id }.toSet()

            assertTrue(
                "Seed $seed: restored chit '${targetChit.id}' must appear in active query",
                activeIds.contains(targetChit.id)
            )
        }
    }

    @Test
    fun `Property 19 - restore does not affect other chits`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(15) + 5
            val allChits = generateMixedChitList(r, size)

            val deletedChits = allChits.filter { it.deleted }
            if (deletedChits.isEmpty()) continue

            val targetChit = deletedChits[r.nextInt(deletedChits.size)]
            val now = "2024-06-15T10:00:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)

            // All other chits should have unchanged deleted state
            for (original in allChits) {
                if (original.id == targetChit.id) continue
                val restored = afterRestore.first { it.id == original.id }
                assertEquals(
                    "Seed $seed: chit '${original.id}' deleted state should be unchanged",
                    original.deleted, restored.deleted
                )
            }
        }
    }

    @Test
    fun `Property 19 - restore updates modifiedDatetime`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(15) + 5
            val allChits = generateMixedChitList(r, size)

            val deletedChits = allChits.filter { it.deleted }
            if (deletedChits.isEmpty()) continue

            val targetChit = deletedChits[r.nextInt(deletedChits.size)]
            val now = "2024-06-15T${10 + r.nextInt(12)}:${r.nextInt(60).toString().padStart(2, '0')}:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)
            val restoredChit = afterRestore.first { it.id == targetChit.id }

            assertEquals(
                "Seed $seed: restored chit should have updated modifiedDatetime",
                now, restoredChit.modifiedDatetime
            )
        }
    }

    @Test
    fun `Property 19 - restore preserves all other fields of the chit`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(15) + 5
            val allChits = generateMixedChitList(r, size)

            val deletedChits = allChits.filter { it.deleted }
            if (deletedChits.isEmpty()) continue

            val targetChit = deletedChits[r.nextInt(deletedChits.size)]
            val now = "2024-06-15T10:00:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)
            val restoredChit = afterRestore.first { it.id == targetChit.id }

            // All fields except deleted and modifiedDatetime should be preserved
            assertEquals("Seed $seed: id preserved", targetChit.id, restoredChit.id)
            assertEquals("Seed $seed: title preserved", targetChit.title, restoredChit.title)
            assertEquals("Seed $seed: note preserved", targetChit.note, restoredChit.note)
            assertEquals("Seed $seed: tags preserved", targetChit.tags, restoredChit.tags)
            assertEquals("Seed $seed: startDatetime preserved", targetChit.startDatetime, restoredChit.startDatetime)
            assertEquals("Seed $seed: endDatetime preserved", targetChit.endDatetime, restoredChit.endDatetime)
            assertEquals("Seed $seed: dueDatetime preserved", targetChit.dueDatetime, restoredChit.dueDatetime)
            assertEquals("Seed $seed: status preserved", targetChit.status, restoredChit.status)
            assertEquals("Seed $seed: priority preserved", targetChit.priority, restoredChit.priority)
            assertEquals("Seed $seed: checklist preserved", targetChit.checklist, restoredChit.checklist)
            assertEquals("Seed $seed: pinned preserved", targetChit.pinned, restoredChit.pinned)
            assertEquals("Seed $seed: archived preserved", targetChit.archived, restoredChit.archived)
            assertEquals("Seed $seed: color preserved", targetChit.color, restoredChit.color)
            assertEquals("Seed $seed: people preserved", targetChit.people, restoredChit.people)
            assertEquals("Seed $seed: createdDatetime preserved", targetChit.createdDatetime, restoredChit.createdDatetime)
            assertEquals("Seed $seed: syncVersion preserved", targetChit.syncVersion, restoredChit.syncVersion)
        }
    }

    @Test
    fun `Property 19 - trash count decreases by 1 after restore`() {
        for (seed in 1..100) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(15) + 5
            val allChits = generateMixedChitList(r, size)

            val trashBefore = simulateTrashQuery(allChits)
            if (trashBefore.isEmpty()) continue

            val targetChit = trashBefore[r.nextInt(trashBefore.size)]
            val now = "2024-06-15T10:00:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)
            val trashAfter = simulateTrashQuery(afterRestore)

            assertEquals(
                "Seed $seed: trash count should decrease by 1 after restore",
                trashBefore.size - 1, trashAfter.size
            )
        }
    }

    @Test
    fun `Property 19 - restoring already non-deleted chit is a no-op for deleted flag`() {
        for (seed in 1..50) {
            val r = java.util.Random(seed.toLong())
            val size = r.nextInt(10) + 5
            val allChits = generateMixedChitList(r, size)

            val activeChits = allChits.filter { !it.deleted }
            if (activeChits.isEmpty()) continue

            val targetChit = activeChits[r.nextInt(activeChits.size)]
            val now = "2024-06-15T10:00:00Z"

            val afterRestore = simulateRestore(allChits, targetChit.id, now)
            val restoredChit = afterRestore.first { it.id == targetChit.id }

            // Should still be non-deleted (no change)
            assertFalse(
                "Seed $seed: restoring non-deleted chit should keep deleted=false",
                restoredChit.deleted
            )

            // Trash count should be unchanged
            val trashBefore = simulateTrashQuery(allChits).size
            val trashAfter = simulateTrashQuery(afterRestore).size
            assertEquals(
                "Seed $seed: trash count unchanged when restoring non-deleted chit",
                trashBefore, trashAfter
            )
        }
    }
}
