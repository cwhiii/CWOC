package com.cwoc.app.ui.screens

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.util.UUID
import kotlin.random.Random

/**
 * Property-based tests for soft-delete and view reactivity.
 *
 * **Validates: Requirements 4.4, 12.4**
 *
 * Property 13: Soft-deleted chits excluded from active views — after soft-deleting
 * a chit, it should no longer appear in task or note queries.
 */
class SoftDeleteViewReactivityPropertyTest {

    private lateinit var fakeDao: ReactiveChitDao

    @Before
    fun setup() {
        fakeDao = ReactiveChitDao()
    }

    // ─── Property 13: Soft-deleted chits excluded from active views ───────────
    // *For any* chit that is soft-deleted (deleted = true), it SHALL NOT appear
    // in getTaskChits() or getNoteChits() query results. The DAO queries filter
    // by `deleted = 0`, so marking a chit as deleted must exclude it from all
    // active views immediately.
    //
    // **Validates: Requirements 4.4, 12.4**

    @Test
    fun `Property 13 - soft-deleted task chit is excluded from getTaskChits`() = runBlocking {
        val iterations = 100

        repeat(iterations) { i ->
            fakeDao.clear()

            // Create a random number of task chits (2-10)
            val numChits = Random.nextInt(2, 11)
            val chits = (0 until numChits).map { j ->
                createTaskChit("task-$i-$j")
            }
            chits.forEach { fakeDao.store(it) }

            // Verify all appear in task view before deletion
            val beforeDelete = fakeDao.getTaskChits().first()
            assertEquals(
                "Iteration $i: all $numChits task chits should appear before deletion",
                numChits,
                beforeDelete.size
            )

            // Pick a random chit to soft-delete
            val targetIndex = Random.nextInt(numChits)
            val targetId = chits[targetIndex].id
            val now = "2025-06-01T12:00:00Z"
            fakeDao.markDeleted(targetId, now)

            // Verify the deleted chit no longer appears in task view
            val afterDelete = fakeDao.getTaskChits().first()
            assertEquals(
                "Iteration $i: should have ${numChits - 1} chits after soft-delete",
                numChits - 1,
                afterDelete.size
            )
            assertFalse(
                "Iteration $i: soft-deleted chit '$targetId' must not appear in getTaskChits()",
                afterDelete.any { it.id == targetId }
            )
        }
    }

    @Test
    fun `Property 13 - soft-deleted note chit is excluded from getNoteChits`() = runBlocking {
        val iterations = 100

        repeat(iterations) { i ->
            fakeDao.clear()

            // Create a random number of note chits (2-10)
            val numChits = Random.nextInt(2, 11)
            val chits = (0 until numChits).map { j ->
                createNoteChit("note-$i-$j")
            }
            chits.forEach { fakeDao.store(it) }

            // Verify all appear in note view before deletion
            val beforeDelete = fakeDao.getNoteChits().first()
            assertEquals(
                "Iteration $i: all $numChits note chits should appear before deletion",
                numChits,
                beforeDelete.size
            )

            // Pick a random chit to soft-delete
            val targetIndex = Random.nextInt(numChits)
            val targetId = chits[targetIndex].id
            val now = "2025-06-01T12:00:00Z"
            fakeDao.markDeleted(targetId, now)

            // Verify the deleted chit no longer appears in note view
            val afterDelete = fakeDao.getNoteChits().first()
            assertEquals(
                "Iteration $i: should have ${numChits - 1} chits after soft-delete",
                numChits - 1,
                afterDelete.size
            )
            assertFalse(
                "Iteration $i: soft-deleted chit '$targetId' must not appear in getNoteChits()",
                afterDelete.any { it.id == targetId }
            )
        }
    }

    @Test
    fun `Property 13 - deleting multiple chits excludes all from views`() = runBlocking {
        val iterations = 50

        repeat(iterations) { i ->
            fakeDao.clear()

            // Create a mix of task and note chits (4-12 total)
            val numTasks = Random.nextInt(2, 7)
            val numNotes = Random.nextInt(2, 7)

            val taskChits = (0 until numTasks).map { j -> createTaskChit("mtask-$i-$j") }
            val noteChits = (0 until numNotes).map { j -> createNoteChit("mnote-$i-$j") }

            taskChits.forEach { fakeDao.store(it) }
            noteChits.forEach { fakeDao.store(it) }

            // Randomly select some to delete (1 to half of each)
            val numTasksToDelete = Random.nextInt(1, (numTasks / 2) + 1)
            val numNotesToDelete = Random.nextInt(1, (numNotes / 2) + 1)

            val tasksToDelete = taskChits.shuffled().take(numTasksToDelete)
            val notesToDelete = noteChits.shuffled().take(numNotesToDelete)

            val now = "2025-06-01T12:00:00Z"
            tasksToDelete.forEach { fakeDao.markDeleted(it.id, now) }
            notesToDelete.forEach { fakeDao.markDeleted(it.id, now) }

            // Verify task view
            val taskResults = fakeDao.getTaskChits().first()
            assertEquals(
                "Iteration $i: task view should have ${numTasks - numTasksToDelete} chits",
                numTasks - numTasksToDelete,
                taskResults.size
            )
            tasksToDelete.forEach { deleted ->
                assertFalse(
                    "Iteration $i: deleted task '${deleted.id}' must not appear in getTaskChits()",
                    taskResults.any { it.id == deleted.id }
                )
            }

            // Verify note view
            val noteResults = fakeDao.getNoteChits().first()
            assertEquals(
                "Iteration $i: note view should have ${numNotes - numNotesToDelete} chits",
                numNotes - numNotesToDelete,
                noteResults.size
            )
            notesToDelete.forEach { deleted ->
                assertFalse(
                    "Iteration $i: deleted note '${deleted.id}' must not appear in getNoteChits()",
                    noteResults.any { it.id == deleted.id }
                )
            }
        }
    }

    @Test
    fun `Property 13 - non-deleted chits remain visible after other chits are deleted`() = runBlocking {
        val iterations = 80

        repeat(iterations) { i ->
            fakeDao.clear()

            // Create task chits
            val numChits = Random.nextInt(3, 10)
            val chits = (0 until numChits).map { j -> createTaskChit("survive-$i-$j") }
            chits.forEach { fakeDao.store(it) }

            // Delete exactly one
            val deleteIndex = Random.nextInt(numChits)
            val deletedId = chits[deleteIndex].id
            fakeDao.markDeleted(deletedId, "2025-06-01T12:00:00Z")

            // All non-deleted chits must still be present
            val results = fakeDao.getTaskChits().first()
            val survivingIds = chits.filterIndexed { idx, _ -> idx != deleteIndex }.map { it.id }

            survivingIds.forEach { id ->
                assertTrue(
                    "Iteration $i: non-deleted chit '$id' must still appear in getTaskChits()",
                    results.any { it.id == id }
                )
            }
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Creates a task chit (has status, not deleted, not archived).
     * Matches the getTaskChits() query: deleted = 0 AND archived = 0 AND status IS NOT NULL
     */
    private fun createTaskChit(id: String): ChitEntity {
        val statuses = listOf("ToDo", "In Progress", "Blocked", "Complete")
        val priorities = listOf("High", "Medium", "Low", null)
        return ChitEntity(
            id = id,
            title = "Task $id",
            note = null,
            tags = null,
            startDatetime = null,
            endDatetime = null,
            dueDatetime = if (Random.nextBoolean()) "2025-07-01T09:00:00Z" else null,
            pointInTime = null,
            completedDatetime = null,
            status = statuses.random(),
            priority = priorities.random(),
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
            createdDatetime = "2025-01-01T00:00:00Z",
            modifiedDatetime = "2025-01-01T00:00:00Z",
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
     * Creates a note chit (has note content, no status, no dates, not deleted, not archived).
     * Matches the getNoteChits() query: deleted = 0 AND archived = 0 AND note IS NOT NULL
     * AND note != '' AND status IS NULL AND startDatetime IS NULL AND endDatetime IS NULL
     */
    private fun createNoteChit(id: String): ChitEntity {
        val notes = listOf(
            "This is a note about $id",
            "Meeting notes for project discussion",
            "Remember to follow up on this item",
            "Quick thought: ${UUID.randomUUID()}"
        )
        return ChitEntity(
            id = id,
            title = "Note $id",
            note = notes.random(),
            tags = null,
            startDatetime = null,
            endDatetime = null,
            dueDatetime = null,
            pointInTime = null,
            completedDatetime = null,
            status = null,
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
            createdDatetime = "2025-01-01T00:00:00Z",
            modifiedDatetime = "2025-01-01T00:00:00Z",
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
}

/**
 * Reactive fake ChitDao that implements the same filtering logic as the real
 * Room DAO queries. Uses a MutableStateFlow-backed store so that query results
 * reflect mutations (markDeleted, upsert) immediately.
 *
 * Key filtering rules (mirroring the @Query annotations in ChitDao):
 * - getTaskChits(): deleted = 0 AND archived = 0 AND status IS NOT NULL
 * - getNoteChits(): deleted = 0 AND archived = 0 AND note IS NOT NULL AND note != ''
 *                   AND status IS NULL AND startDatetime IS NULL AND endDatetime IS NULL
 */
class ReactiveChitDao : ChitDao {

    private val storeState = MutableStateFlow<Map<String, ChitEntity>>(emptyMap())

    fun store(entity: ChitEntity) {
        storeState.value = storeState.value + (entity.id to entity)
    }

    fun clear() {
        storeState.value = emptyMap()
    }

    override suspend fun getById(id: String): ChitEntity? = storeState.value[id]

    override fun getTaskChits(): Flow<List<ChitEntity>> = storeState.map { store ->
        store.values
            .filter { !it.deleted && !it.archived && it.status != null }
            .sortedWith(compareByDescending<ChitEntity> { it.priority }.thenBy { it.dueDatetime })
    }

    override fun getTasksByStatus(status: String): Flow<List<ChitEntity>> = storeState.map { store ->
        store.values.filter { !it.deleted && !it.archived && it.status == status }
    }

    override fun getNoteChits(): Flow<List<ChitEntity>> = storeState.map { store ->
        store.values.filter { chit ->
            !chit.deleted && !chit.archived &&
                !chit.note.isNullOrEmpty() &&
                chit.status == null &&
                chit.startDatetime == null &&
                chit.endDatetime == null
        }
    }

    override fun getCalendarChits(): Flow<List<ChitEntity>> = storeState.map { store ->
        store.values.filter { !it.deleted && !it.archived && (it.startDatetime != null || it.endDatetime != null) }
    }

    override fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> =
        storeState.map { emptyList() }

    override suspend fun upsertAll(chits: List<ChitEntity>) {
        storeState.value = storeState.value + chits.associateBy { it.id }
    }

    override suspend fun upsert(chit: ChitEntity) {
        storeState.value = storeState.value + (chit.id to chit)
    }

    override suspend fun markDeleted(id: String, now: String) {
        val entity = storeState.value[id] ?: return
        storeState.value = storeState.value + (id to entity.copy(deleted = true, modifiedDatetime = now))
    }

    override suspend fun getCount(): Int = storeState.value.size

    override suspend fun getFirstFive(): List<ChitEntity> = storeState.value.values.take(5)

    override suspend fun getDirtyChits(): List<ChitEntity> =
        storeState.value.values.filter { it.isDirty }

    override suspend fun getDirtyCount(): Int =
        storeState.value.values.count { it.isDirty }

    override suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) {
        val entity = storeState.value[id] ?: return
        storeState.value = storeState.value + (id to entity.copy(isDirty = isDirty, dirtyFields = dirtyFields))
    }

    override suspend fun updateSyncVersion(id: String, version: Int) {
        val entity = storeState.value[id] ?: return
        storeState.value = storeState.value + (id to entity.copy(syncVersion = version))
    }
}
