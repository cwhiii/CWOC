package com.cwoc.app.data.sync

import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.SyncMetadataEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import java.io.IOException
import kotlin.random.Random

/**
 * Property-based tests for SyncPushEngine push response handling.
 *
 * **Validates: Requirements 5.3, 5.4, 5.5, 7.3, 7.4, 7.5, 7.6, 7.7**
 *
 * Property 7: Successful push clears dirty state
 * Property 8: Merged push updates local entity
 * Property 9: Failed push preserves dirty state
 */
class SyncPushEnginePropertyTest {

    private lateinit var fakeApiService: FakeCwocApiService
    private lateinit var fakeChitDao: FakePushChitDao
    private lateinit var fakeDirtyTracker: FakeDirtyTracker
    private lateinit var fakeSyncMetadataDao: FakeSyncMetadataDao
    private lateinit var fakeSyncStateManager: FakeSyncStateManager
    private lateinit var pushEngine: SyncPushEngineImpl
    private val gson = Gson()

    @Before
    fun setup() {
        fakeApiService = FakeCwocApiService()
        fakeChitDao = FakePushChitDao()
        fakeDirtyTracker = FakeDirtyTracker(fakeChitDao)
        fakeSyncMetadataDao = FakeSyncMetadataDao()
        fakeSyncStateManager = FakeSyncStateManager()
        pushEngine = SyncPushEngineImpl(
            apiService = fakeApiService,
            chitDao = fakeChitDao,
            dirtyTracker = fakeDirtyTracker,
            syncMetadataDao = fakeSyncMetadataDao,
            syncStateManager = fakeSyncStateManager,
            gson = gson
        )
    }

    // ─── Property 7: Successful push clears dirty state ──────────────────────
    // *For any* dirty chit that is pushed and receives an "accepted" or "created"
    // status from the server, the entity SHALL have isDirty=false and
    // dirtyFields="[]" after the push completes.
    //
    // **Validates: Requirements 5.3, 7.3, 7.4**

    @Test
    fun `Property 7 - accepted status clears dirty state`() = runBlocking {
        val iterations = 50
        val allFieldNames = listOf(
            "title", "note", "tags", "start_datetime", "end_datetime",
            "due_datetime", "status", "priority", "location", "color"
        )

        repeat(iterations) { i ->
            val chitId = "accepted-$i"
            val numFields = Random.nextInt(1, allFieldNames.size + 1)
            val dirtyFields = allFieldNames.shuffled().take(numFields)
            val entity = createDirtyEntity(chitId, dirtyFields)
            fakeChitDao.store(entity)

            val newSyncVersion = Random.nextInt(1, 1000)
            fakeApiService.configureResponse(
                chitId = chitId,
                status = "accepted",
                syncVersion = newSyncVersion
            )

            val result = pushEngine.pushSingle(chitId)

            assertTrue(
                "Iteration $i: push should succeed for accepted status",
                result is PushResult.Success
            )

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertFalse(
                "Iteration $i: isDirty must be false after accepted push",
                updatedEntity.isDirty
            )
            assertEquals(
                "Iteration $i: dirtyFields must be '[]' after accepted push",
                "[]",
                updatedEntity.dirtyFields
            )
        }
    }

    @Test
    fun `Property 7 - created status clears dirty state`() = runBlocking {
        val iterations = 50
        val allFieldNames = listOf(
            "title", "note", "tags", "start_datetime", "end_datetime",
            "due_datetime", "status", "priority", "location", "color"
        )

        repeat(iterations) { i ->
            val chitId = "created-$i"
            val numFields = Random.nextInt(1, allFieldNames.size + 1)
            val dirtyFields = allFieldNames.shuffled().take(numFields)
            val entity = createDirtyEntity(chitId, dirtyFields)
            fakeChitDao.store(entity)

            val newSyncVersion = Random.nextInt(1, 1000)
            fakeApiService.configureResponse(
                chitId = chitId,
                status = "created",
                syncVersion = newSyncVersion
            )

            val result = pushEngine.pushSingle(chitId)

            assertTrue(
                "Iteration $i: push should succeed for created status",
                result is PushResult.Success
            )

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertFalse(
                "Iteration $i: isDirty must be false after created push",
                updatedEntity.isDirty
            )
            assertEquals(
                "Iteration $i: dirtyFields must be '[]' after created push",
                "[]",
                updatedEntity.dirtyFields
            )
        }
    }

    @Test
    fun `Property 7 - syncVersion is updated after accepted or created push`() = runBlocking {
        val iterations = 50

        repeat(iterations) { i ->
            val chitId = "version-$i"
            val entity = createDirtyEntity(chitId, listOf("title"))
            fakeChitDao.store(entity)

            val status = if (Random.nextBoolean()) "accepted" else "created"
            val newSyncVersion = Random.nextInt(1, 10000)
            fakeApiService.configureResponse(
                chitId = chitId,
                status = status,
                syncVersion = newSyncVersion
            )

            pushEngine.pushSingle(chitId)

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertEquals(
                "Iteration $i: syncVersion must be updated to server value after $status",
                newSyncVersion,
                updatedEntity.syncVersion
            )
        }
    }

    // ─── Property 8: Merged push updates local entity ────────────────────────
    // *For any* dirty chit that is pushed and receives a "merged" status from
    // the server, the local entity SHALL be replaced with the server-merged
    // version, with isDirty=false and dirtyFields="[]".
    //
    // **Validates: Requirements 5.4, 7.5**

    @Test
    fun `Property 8 - merged status replaces local entity with server version`() = runBlocking {
        val iterations = 50

        repeat(iterations) { i ->
            val chitId = "merged-$i"
            val originalTitle = "Original Title $i"
            val entity = createDirtyEntity(chitId, listOf("title", "note")).copy(
                title = originalTitle,
                note = "Original note $i"
            )
            fakeChitDao.store(entity)

            // Server returns a merged entity with different field values
            val mergedTitle = "Server Merged Title $i"
            val mergedNote = "Server merged note $i"
            val mergedSyncVersion = Random.nextInt(1, 10000)
            val mergedDto = ChitDto(
                id = chitId,
                title = mergedTitle,
                note = mergedNote,
                tags = listOf("merged-tag"),
                start_datetime = null,
                end_datetime = null,
                due_datetime = null,
                point_in_time = null,
                completed_datetime = null,
                status = "in_progress",
                priority = "high",
                severity = null,
                checklist = null,
                alarm = null,
                notification = null,
                recurrence = null,
                recurrence_id = null,
                recurrence_rule = null,
                recurrence_exceptions = null,
                location = null,
                color = null,
                people = null,
                pinned = false,
                archived = false,
                deleted = false,
                created_datetime = "2025-01-01T00:00:00Z",
                modified_datetime = "2025-06-01T12:00:00Z",
                is_project_master = false,
                child_chits = null,
                all_day = false,
                timezone = null,
                alerts = null,
                progress_percent = null,
                time_estimate = null,
                weather_data = null,
                health_data = null,
                habit = false,
                habit_goal = null,
                habit_success = null,
                show_on_calendar = null,
                habit_reset_period = null,
                habit_last_action_date = null,
                habit_hide_overall = null,
                perpetual = false,
                shares = null,
                stealth = null,
                assigned_to = null,
                owner_id = null,
                has_unviewed_conflict = false,
                availability = null,
                snoozed_until = null,
                prerequisites = null,
                sync_version = mergedSyncVersion
            )

            fakeApiService.configureResponse(
                chitId = chitId,
                status = "merged",
                syncVersion = mergedSyncVersion,
                mergedDto = mergedDto,
                conflictFields = listOf("title", "note")
            )

            val result = pushEngine.pushSingle(chitId)

            assertTrue(
                "Iteration $i: push should succeed for merged status",
                result is PushResult.Success
            )

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertFalse(
                "Iteration $i: isDirty must be false after merged push",
                updatedEntity.isDirty
            )
            assertEquals(
                "Iteration $i: dirtyFields must be '[]' after merged push",
                "[]",
                updatedEntity.dirtyFields
            )
            assertEquals(
                "Iteration $i: title must be replaced with server-merged value",
                mergedTitle,
                updatedEntity.title
            )
            assertEquals(
                "Iteration $i: note must be replaced with server-merged value",
                mergedNote,
                updatedEntity.note
            )
        }
    }

    @Test
    fun `Property 8 - merged status preserves server syncVersion`() = runBlocking {
        val iterations = 30

        repeat(iterations) { i ->
            val chitId = "merged-ver-$i"
            val entity = createDirtyEntity(chitId, listOf("title"))
            fakeChitDao.store(entity)

            val mergedSyncVersion = Random.nextInt(1, 10000)
            val mergedDto = createMergedDto(chitId, mergedSyncVersion)

            fakeApiService.configureResponse(
                chitId = chitId,
                status = "merged",
                syncVersion = mergedSyncVersion,
                mergedDto = mergedDto,
                conflictFields = listOf("title")
            )

            pushEngine.pushSingle(chitId)

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertEquals(
                "Iteration $i: syncVersion must match server-merged version",
                mergedSyncVersion,
                updatedEntity.syncVersion
            )
        }
    }

    // ─── Property 9: Failed push preserves dirty state ───────────────────────
    // *For any* dirty chit that is pushed and receives an "error" status from
    // the server OR a network failure, isDirty and dirtyFields SHALL remain
    // unchanged (dirty state preserved for retry).
    //
    // **Validates: Requirements 5.5, 7.6, 7.7**

    @Test
    fun `Property 9 - error status preserves dirty state`() = runBlocking {
        val iterations = 50
        val allFieldNames = listOf(
            "title", "note", "tags", "start_datetime", "end_datetime",
            "due_datetime", "status", "priority", "location", "color",
            "alerts", "recurrence", "timezone", "availability"
        )

        repeat(iterations) { i ->
            val chitId = "error-$i"
            val numFields = Random.nextInt(1, allFieldNames.size + 1)
            val dirtyFields = allFieldNames.shuffled().take(numFields)
            val entity = createDirtyEntity(chitId, dirtyFields)
            fakeChitDao.store(entity)

            fakeApiService.configureResponse(
                chitId = chitId,
                status = "error",
                syncVersion = null,
                conflictFields = listOf("title")
            )

            val result = pushEngine.pushSingle(chitId)

            assertTrue(
                "Iteration $i: push should return Partial for error status",
                result is PushResult.Partial
            )

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertTrue(
                "Iteration $i: isDirty must remain true after error push",
                updatedEntity.isDirty
            )

            val remainingFields = parseDirtyFields(updatedEntity.dirtyFields)
            assertEquals(
                "Iteration $i: dirtyFields must be preserved after error push",
                dirtyFields.toSet(),
                remainingFields
            )
        }
    }

    @Test
    fun `Property 9 - network failure preserves dirty state`() = runBlocking {
        val iterations = 50
        val allFieldNames = listOf(
            "title", "note", "tags", "start_datetime", "end_datetime",
            "due_datetime", "status", "priority", "location", "color"
        )

        repeat(iterations) { i ->
            val chitId = "netfail-$i"
            val numFields = Random.nextInt(1, allFieldNames.size + 1)
            val dirtyFields = allFieldNames.shuffled().take(numFields)
            val entity = createDirtyEntity(chitId, dirtyFields)
            fakeChitDao.store(entity)

            // Configure the API to throw a network exception
            fakeApiService.shouldThrowNetworkError = true

            val result = pushEngine.pushSingle(chitId)

            assertTrue(
                "Iteration $i: push should return NetworkError on network failure",
                result is PushResult.NetworkError
            )

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertTrue(
                "Iteration $i: isDirty must remain true after network failure",
                updatedEntity.isDirty
            )

            val remainingFields = parseDirtyFields(updatedEntity.dirtyFields)
            assertEquals(
                "Iteration $i: dirtyFields must be preserved after network failure",
                dirtyFields.toSet(),
                remainingFields
            )

            // Reset for next iteration
            fakeApiService.shouldThrowNetworkError = false
        }
    }

    @Test
    fun `Property 9 - HTTP error response preserves dirty state`() = runBlocking {
        val iterations = 30
        val allFieldNames = listOf(
            "title", "note", "tags", "status", "priority", "location"
        )

        repeat(iterations) { i ->
            val chitId = "http-err-$i"
            val numFields = Random.nextInt(1, allFieldNames.size + 1)
            val dirtyFields = allFieldNames.shuffled().take(numFields)
            val entity = createDirtyEntity(chitId, dirtyFields)
            fakeChitDao.store(entity)

            // Configure the API to return an HTTP error (e.g. 500)
            val httpCode = listOf(400, 401, 403, 500, 502, 503).random()
            fakeApiService.shouldReturnHttpError = httpCode

            val result = pushEngine.pushSingle(chitId)

            assertTrue(
                "Iteration $i: push should return NetworkError on HTTP $httpCode",
                result is PushResult.NetworkError
            )

            val updatedEntity = fakeChitDao.getById(chitId)!!
            assertTrue(
                "Iteration $i: isDirty must remain true after HTTP $httpCode",
                updatedEntity.isDirty
            )

            val remainingFields = parseDirtyFields(updatedEntity.dirtyFields)
            assertEquals(
                "Iteration $i: dirtyFields must be preserved after HTTP $httpCode",
                dirtyFields.toSet(),
                remainingFields
            )

            // Reset for next iteration
            fakeApiService.shouldReturnHttpError = null
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun createDirtyEntity(
        id: String,
        dirtyFields: List<String>
    ): ChitEntity {
        return ChitEntity(
            id = id,
            title = "Test Chit $id",
            note = "Note for $id",
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
            isDirty = true,
            dirtyFields = gson.toJson(dirtyFields)
        )
    }

    private fun createMergedDto(chitId: String, syncVersion: Int): ChitDto {
        return ChitDto(
            id = chitId,
            title = "Merged $chitId",
            note = "Merged note",
            tags = null,
            start_datetime = null,
            end_datetime = null,
            due_datetime = null,
            point_in_time = null,
            completed_datetime = null,
            status = null,
            priority = null,
            severity = null,
            checklist = null,
            alarm = null,
            notification = null,
            recurrence = null,
            recurrence_id = null,
            recurrence_rule = null,
            recurrence_exceptions = null,
            location = null,
            color = null,
            people = null,
            pinned = false,
            archived = false,
            deleted = false,
            created_datetime = "2025-01-01T00:00:00Z",
            modified_datetime = "2025-06-01T12:00:00Z",
            is_project_master = false,
            child_chits = null,
            all_day = false,
            timezone = null,
            alerts = null,
            progress_percent = null,
            time_estimate = null,
            weather_data = null,
            health_data = null,
            habit = false,
            habit_goal = null,
            habit_success = null,
            show_on_calendar = null,
            habit_reset_period = null,
            habit_last_action_date = null,
            habit_hide_overall = null,
            perpetual = false,
            shares = null,
            stealth = null,
            assigned_to = null,
            owner_id = null,
            has_unviewed_conflict = false,
            availability = null,
            snoozed_until = null,
            prerequisites = null,
            sync_version = syncVersion
        )
    }

    private fun parseDirtyFields(json: String?): Set<String> {
        if (json.isNullOrBlank() || json == "[]") return emptySet()
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson<List<String>>(json, type).toSet()
    }
}

// ─── Fake Implementations ─────────────────────────────────────────────────────

/**
 * Fake CwocApiService that returns configurable push responses.
 * Supports per-chit result configuration, network errors, and HTTP errors.
 */
class FakeCwocApiService : CwocApiService {

    private val responseConfigs = mutableMapOf<String, ChitPushResultDto>()
    var shouldThrowNetworkError = false
    var shouldReturnHttpError: Int? = null
    private var serverVersion = 1

    fun configureResponse(
        chitId: String,
        status: String,
        syncVersion: Int? = null,
        mergedDto: ChitDto? = null,
        conflictFields: List<String>? = null
    ) {
        responseConfigs[chitId] = ChitPushResultDto(
            id = chitId,
            status = status,
            sync_version = syncVersion,
            conflict_fields = conflictFields,
            merged = mergedDto
        )
        if (syncVersion != null) {
            serverVersion = syncVersion
        }
    }

    override suspend fun pushChanges(request: SyncPushRequestDto): Response<SyncPushResponseDto> {
        if (shouldThrowNetworkError) {
            throw IOException("Simulated network failure")
        }

        shouldReturnHttpError?.let { code ->
            return Response.error(
                code,
                "Error".toResponseBody("application/json".toMediaType())
            )
        }

        val results = request.chits.map { pushDto ->
            responseConfigs[pushDto.id] ?: ChitPushResultDto(
                id = pushDto.id,
                status = "accepted",
                sync_version = 1,
                conflict_fields = null,
                merged = null
            )
        }

        val responseBody = SyncPushResponseDto(
            results = PushResultsDto(chits = results),
            server_version = serverVersion
        )

        return Response.success(responseBody)
    }

    // Unused methods — required by interface
    override suspend fun authenticate(request: DeviceTokenRequest): Response<DeviceTokenResponse> {
        throw UnsupportedOperationException("Not used in push tests")
    }

    override suspend fun getSyncChanges(since: Int, include: String): Response<SyncResponseDto> {
        throw UnsupportedOperationException("Not used in push tests")
    }

    override suspend fun postClientLog(entry: ClientLogRequest): Response<ClientLogResponse> {
        throw UnsupportedOperationException("Not used in push tests")
    }
}

/**
 * Fake ChitDao for push engine tests.
 * Stores entities in-memory and supports all DAO methods used by SyncPushEngineImpl.
 */
class FakePushChitDao : ChitDao {

    private val entities = mutableMapOf<String, ChitEntity>()

    fun store(entity: ChitEntity) {
        entities[entity.id] = entity
    }

    override suspend fun getById(id: String): ChitEntity? = entities[id]

    override suspend fun getDirtyChits(): List<ChitEntity> =
        entities.values.filter { it.isDirty }

    override suspend fun getDirtyCount(): Int =
        entities.values.count { it.isDirty }

    override suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(isDirty = isDirty, dirtyFields = dirtyFields)
    }

    override suspend fun upsert(chit: ChitEntity) {
        entities[chit.id] = chit
    }

    override suspend fun upsertAll(chits: List<ChitEntity>) {
        chits.forEach { entities[it.id] = it }
    }

    override suspend fun updateSyncVersion(id: String, version: Int) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(syncVersion = version)
    }

    override suspend fun markDeleted(id: String, now: String) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(deleted = true, modifiedDatetime = now)
    }

    override fun getTaskChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getTasksByStatus(status: String): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getNoteChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getCalendarChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> = flowOf(emptyList())
    override suspend fun getCount(): Int = entities.size
    override suspend fun getFirstFive(): List<ChitEntity> = entities.values.take(5)
}

/**
 * Fake DirtyTracker that delegates to the FakePushChitDao.
 * Mirrors the real DirtyTrackerImpl behavior for test verification.
 */
class FakeDirtyTracker(private val chitDao: ChitDao) : DirtyTracker {

    override suspend fun markDirty(chitId: String, changedFields: Set<String>) {
        val entity = chitDao.getById(chitId) ?: return
        val existingFields = parseDirtyFields(entity.dirtyFields)
        val mergedFields = existingFields + changedFields
        chitDao.updateDirtyState(
            id = chitId,
            isDirty = true,
            dirtyFields = Gson().toJson(mergedFields.toList())
        )
    }

    override suspend fun clearDirty(chitId: String) {
        chitDao.updateDirtyState(
            id = chitId,
            isDirty = false,
            dirtyFields = "[]"
        )
    }

    override suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity) {
        val cleanEntity = mergedEntity.copy(isDirty = false, dirtyFields = "[]")
        chitDao.upsert(cleanEntity)
    }

    private fun parseDirtyFields(json: String?): Set<String> {
        if (json.isNullOrBlank() || json == "[]") return emptySet()
        val type = object : TypeToken<List<String>>() {}.type
        return Gson().fromJson<List<String>>(json, type).toSet()
    }
}

/**
 * Fake SyncMetadataDao that stores metadata in-memory.
 */
class FakeSyncMetadataDao : SyncMetadataDao {

    var lastHighWaterMark: Int = 0
    var lastTimestamp: String? = null
    var lastStatus: String? = null
    private var metadata: SyncMetadataEntity? = null

    override suspend fun upsert(metadata: SyncMetadataEntity) {
        this.metadata = metadata
    }

    override suspend fun getMetadata(): SyncMetadataEntity? = metadata

    override suspend fun updateHighWaterMark(version: Int, timestamp: String) {
        lastHighWaterMark = version
        lastTimestamp = timestamp
    }

    override suspend fun updateSyncStatus(status: String) {
        lastStatus = status
    }
}

/**
 * Fake SyncStateManager that tracks state transitions.
 */
class FakeSyncStateManager : SyncStateManager {

    private val _syncState = MutableStateFlow(SyncState.ONLINE_IDLE)
    override val syncState: StateFlow<SyncState> = _syncState

    var syncingCount = 0
    var idleCount = 0

    override fun setSyncing() {
        syncingCount++
        _syncState.value = SyncState.SYNCING
    }

    override fun setIdle() {
        idleCount++
        _syncState.value = SyncState.ONLINE_IDLE
    }
}
