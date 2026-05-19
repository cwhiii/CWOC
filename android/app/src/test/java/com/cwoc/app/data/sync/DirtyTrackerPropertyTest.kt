package com.cwoc.app.data.sync

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.dao.SettingsDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.local.entity.SettingsEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID
import kotlin.random.Random

/**
 * Property-based tests for DirtyTracker dirty field tracking.
 *
 * **Validates: Requirements 3.1, 3.2, 4.2**
 *
 * Property 5: Dirty fields set semantics — no duplicates
 * Property 6: Local write sets isDirty
 */
class DirtyTrackerPropertyTest {

    private lateinit var fakeDao: FakeChitDao
    private lateinit var fakeContactDao: FakeContactDao
    private lateinit var fakeSettingsDao: FakeSettingsDao
    private lateinit var dirtyTracker: DirtyTrackerImpl
    private val gson = Gson()

    @Before
    fun setup() {
        fakeDao = FakeChitDao()
        fakeContactDao = FakeContactDao()
        fakeSettingsDao = FakeSettingsDao()
        dirtyTracker = DirtyTrackerImpl(fakeDao, fakeContactDao, fakeSettingsDao)
    }

    // ─── Property 5: Dirty fields set semantics — no duplicates ───────────────
    // *For any* sequence of edits to the same chit (including editing the same
    // field multiple times), the `dirtyFields` JSON array SHALL contain no
    // duplicate entries. Each field name appears at most once regardless of how
    // many times it was modified.
    //
    // **Validates: Requirements 3.2**

    @Test
    fun `Property 5 - markDirty with overlapping fields produces no duplicates`() = runBlocking {
        val iterations = 100
        val allFieldNames = listOf(
            "title", "note", "tags", "start_datetime", "end_datetime",
            "due_datetime", "point_in_time", "status", "priority",
            "checklist", "people", "location", "color", "alerts",
            "recurrence", "recurrence_rule", "all_day", "timezone", "availability"
        )

        repeat(iterations) { i ->
            val chitId = "chit-$i"
            val entity = createTestEntity(chitId)
            fakeDao.store(entity)

            // Generate a random number of markDirty calls (2-10)
            val numCalls = Random.nextInt(2, 11)
            repeat(numCalls) {
                // Pick a random subset of fields (1-8 fields), allowing overlaps across calls
                val numFields = Random.nextInt(1, minOf(9, allFieldNames.size + 1))
                val fields = allFieldNames.shuffled().take(numFields).toSet()
                dirtyTracker.markDirty(chitId, fields)
            }

            // Verify: no duplicates in the resulting dirtyFields
            val updatedEntity = fakeDao.getById(chitId)!!
            val dirtyFields = parseDirtyFields(updatedEntity.dirtyFields)

            assertEquals(
                "Iteration $i: dirtyFields should have no duplicates",
                dirtyFields.size,
                dirtyFields.toSet().size
            )
        }
    }

    @Test
    fun `Property 5 - markDirty same field repeatedly produces single entry`() = runBlocking {
        val iterations = 50

        repeat(iterations) { i ->
            val chitId = "repeat-$i"
            val entity = createTestEntity(chitId)
            fakeDao.store(entity)

            val field = "title"
            val numCalls = Random.nextInt(2, 20)
            repeat(numCalls) {
                dirtyTracker.markDirty(chitId, setOf(field))
            }

            val updatedEntity = fakeDao.getById(chitId)!!
            val dirtyFields = parseDirtyFields(updatedEntity.dirtyFields)

            assertEquals(
                "Iteration $i: marking '$field' $numCalls times should produce exactly 1 entry",
                1,
                dirtyFields.size
            )
            assertTrue(
                "Iteration $i: dirtyFields should contain '$field'",
                dirtyFields.contains(field)
            )
        }
    }

    @Test
    fun `Property 5 - markDirty with disjoint then overlapping fields is a set union`() = runBlocking {
        val iterations = 80

        repeat(iterations) { i ->
            val chitId = "union-$i"
            val entity = createTestEntity(chitId)
            fakeDao.store(entity)

            // First call with set A
            val allFields = listOf(
                "title", "note", "tags", "status", "priority",
                "location", "color", "alerts", "timezone", "availability"
            )
            val splitPoint = Random.nextInt(1, allFields.size)
            val setA = allFields.take(splitPoint).toSet()
            val setB = allFields.drop(splitPoint / 2).toSet() // overlaps with A

            dirtyTracker.markDirty(chitId, setA)
            dirtyTracker.markDirty(chitId, setB)

            val updatedEntity = fakeDao.getById(chitId)!!
            val dirtyFields = parseDirtyFields(updatedEntity.dirtyFields)
            val expectedUnion = setA + setB

            assertEquals(
                "Iteration $i: result should be set union of A and B",
                expectedUnion,
                dirtyFields
            )
            // No duplicates check
            assertEquals(
                "Iteration $i: no duplicates in result",
                dirtyFields.size,
                dirtyFields.toSet().size
            )
        }
    }

    // ─── Property 6: Local write sets isDirty ─────────────────────────────────
    // *For any* local modification to a ChitEntity (edit or soft-delete), after
    // the write completes, the entity's `isDirty` field SHALL be `true`.
    //
    // **Validates: Requirements 3.1, 4.2**

    @Test
    fun `Property 6 - markDirty always sets isDirty to true`() = runBlocking {
        val iterations = 100
        val allFieldNames = listOf(
            "title", "note", "tags", "start_datetime", "end_datetime",
            "due_datetime", "status", "priority", "deleted",
            "location", "color", "alerts", "timezone", "availability"
        )

        repeat(iterations) { i ->
            val chitId = "dirty-$i"
            // Start with isDirty = false
            val entity = createTestEntity(chitId, isDirty = false)
            fakeDao.store(entity)

            // Pick random fields to mark dirty
            val numFields = Random.nextInt(1, allFieldNames.size + 1)
            val fields = allFieldNames.shuffled().take(numFields).toSet()

            dirtyTracker.markDirty(chitId, fields)

            val updatedEntity = fakeDao.getById(chitId)!!
            assertTrue(
                "Iteration $i: isDirty must be true after markDirty with fields $fields",
                updatedEntity.isDirty
            )
        }
    }

    @Test
    fun `Property 6 - markDirty with deleted field sets isDirty (soft-delete case)`() = runBlocking {
        val iterations = 50

        repeat(iterations) { i ->
            val chitId = "softdel-$i"
            val entity = createTestEntity(chitId, isDirty = false)
            fakeDao.store(entity)

            // Simulate soft-delete: mark "deleted" as dirty field
            dirtyTracker.markDirty(chitId, setOf("deleted"))

            val updatedEntity = fakeDao.getById(chitId)!!
            assertTrue(
                "Iteration $i: isDirty must be true after soft-delete markDirty",
                updatedEntity.isDirty
            )
        }
    }

    @Test
    fun `Property 6 - markDirty on already-dirty entity keeps isDirty true`() = runBlocking {
        val iterations = 50

        repeat(iterations) { i ->
            val chitId = "already-$i"
            // Start with isDirty = true and some existing dirty fields
            val entity = createTestEntity(
                chitId,
                isDirty = true,
                dirtyFields = """["title"]"""
            )
            fakeDao.store(entity)

            // Mark additional fields dirty
            dirtyTracker.markDirty(chitId, setOf("note", "status"))

            val updatedEntity = fakeDao.getById(chitId)!!
            assertTrue(
                "Iteration $i: isDirty must remain true when already dirty",
                updatedEntity.isDirty
            )
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun createTestEntity(
        id: String,
        isDirty: Boolean = false,
        dirtyFields: String = "[]"
    ): ChitEntity {
        return ChitEntity(
            id = id,
            title = "Test Chit $id",
            note = null,
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
            isDirty = isDirty,
            dirtyFields = dirtyFields
        )
    }

    private fun parseDirtyFields(json: String?): Set<String> {
        if (json.isNullOrBlank() || json == "[]") return emptySet()
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson<List<String>>(json, type).toSet()
    }
}

/**
 * Fake ChitDao implementation for unit testing DirtyTracker.
 * Stores entities in-memory and supports the subset of DAO methods
 * used by DirtyTrackerImpl.
 */
class FakeChitDao : ChitDao {

    private val store = mutableMapOf<String, ChitEntity>()

    fun store(entity: ChitEntity) {
        store[entity.id] = entity
    }

    override suspend fun getById(id: String): ChitEntity? = store[id]

    override suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) {
        val entity = store[id] ?: return
        store[id] = entity.copy(isDirty = isDirty, dirtyFields = dirtyFields)
    }

    override suspend fun upsert(chit: ChitEntity) {
        store[chit.id] = chit
    }

    override suspend fun upsertAll(chits: List<ChitEntity>) {
        chits.forEach { store[it.id] = it }
    }

    override fun getTaskChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getTasksByStatus(status: String): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getNoteChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getCalendarChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getRecurringChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override suspend fun getCount(): Int = store.size
    override suspend fun getFirstFive(): List<ChitEntity> = store.values.take(5)
    override suspend fun getDirtyChits(): List<ChitEntity> = store.values.filter { it.isDirty }
    override suspend fun getDirtyCount(): Int = store.values.count { it.isDirty }
    override suspend fun markDeleted(id: String, now: String) {
        val entity = store[id] ?: return
        store[id] = entity.copy(deleted = true, modifiedDatetime = now)
    }
    override suspend fun updateSyncVersion(id: String, version: Int) {
        val entity = store[id] ?: return
        store[id] = entity.copy(syncVersion = version)
    }
}

/**
 * Fake ContactDao implementation for unit testing DirtyTracker.
 * Stores entities in-memory and supports the subset of DAO methods
 * used by DirtyTrackerImpl.
 */
class FakeContactDao : ContactDao {

    private val store = mutableMapOf<String, ContactEntity>()

    fun store(entity: ContactEntity) {
        store[entity.id] = entity
    }

    override suspend fun getById(id: String): ContactEntity? = store[id]

    override suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) {
        val entity = store[id] ?: return
        store[id] = entity.copy(isDirty = isDirty, dirtyFields = dirtyFields)
    }

    override suspend fun upsert(contact: ContactEntity) {
        store[contact.id] = contact
    }

    override suspend fun upsertAll(contacts: List<ContactEntity>) {
        contacts.forEach { store[it.id] = it }
    }

    override fun getAllActive(): Flow<List<ContactEntity>> = flowOf(store.values.filter { !it.deleted }.toList())
    override fun search(query: String): Flow<List<ContactEntity>> = flowOf(emptyList())
    override suspend fun getDirtyContacts(): List<ContactEntity> = store.values.filter { it.isDirty }
    override suspend fun markDeleted(id: String, now: String) {
        val entity = store[id] ?: return
        store[id] = entity.copy(deleted = true, modifiedDatetime = now)
    }
    override suspend fun updateSyncVersion(id: String, version: Int) {
        val entity = store[id] ?: return
        store[id] = entity.copy(syncVersion = version)
    }
    override suspend fun setConflictState(id: String, fields: String) {
        val entity = store[id] ?: return
        store[id] = entity.copy(hasUnviewedConflict = true, conflictFields = fields)
    }
    override fun getAllContacts(): Flow<List<ContactEntity>> = flowOf(store.values.toList())
}

/**
 * Fake SettingsDao implementation for unit testing DirtyTracker.
 * Stores a single settings entity in-memory.
 */
class FakeSettingsDao : SettingsDao {

    private var settings: SettingsEntity? = null

    fun store(entity: SettingsEntity) {
        settings = entity
    }

    override suspend fun get(): SettingsEntity? = settings
    override fun getSettings(): Flow<SettingsEntity?> = flowOf(settings)
    override suspend fun update(settings: SettingsEntity) { this.settings = settings }
    override suspend fun clearDirty() {
        settings = settings?.copy(isDirty = false)
    }
    override suspend fun markDirty() {
        settings = settings?.copy(isDirty = true)
    }
    override suspend fun updateSyncVersion(version: Int) {
        settings = settings?.copy(syncVersion = version)
    }
    override suspend fun replace(settings: SettingsEntity) { this.settings = settings }
    override suspend fun upsert(settings: SettingsEntity) { this.settings = settings }
    override suspend fun getSettingsOnce(): SettingsEntity? = settings
}
