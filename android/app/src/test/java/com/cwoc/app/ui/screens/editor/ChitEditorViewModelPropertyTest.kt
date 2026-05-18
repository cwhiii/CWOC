package com.cwoc.app.ui.screens.editor

import androidx.lifecycle.SavedStateHandle
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.mapper.ChitFormState
import com.cwoc.app.data.mapper.detectChangedFields
import com.cwoc.app.data.mapper.toEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.dto.AttachmentUploadResponse
import com.cwoc.app.data.remote.dto.ClientLogRequest
import com.cwoc.app.data.remote.dto.ClientLogResponse
import com.cwoc.app.data.remote.dto.DeviceTokenRequest
import com.cwoc.app.data.remote.dto.DeviceTokenResponse
import com.cwoc.app.data.remote.dto.SyncPushRequestDto
import com.cwoc.app.data.remote.dto.SyncPushResponseDto
import com.cwoc.app.data.remote.dto.SyncResponseDto
import com.cwoc.app.data.repository.SettingsRepository
import com.cwoc.app.data.sync.ConnectivityEvent
import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.PushResult
import com.cwoc.app.data.sync.SyncPushEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import kotlin.random.Random

/**
 * Property-based tests for ChitEditorViewModel save/create flows.
 *
 * Property 3: New chit creation invariants — when creating a new chit, the saved
 * entity must have a valid UUID, isDirty=true, and all form fields persisted.
 *
 * Property 4: Dirty fields completeness on creation — for a new chit, all
 * non-default fields in the form should appear in the dirty fields set.
 *
 * **Validates: Requirements 2.2, 2.3**
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ChitEditorViewModelPropertyTest {

    private lateinit var fakeChitDao: FakeEditorChitDao
    private lateinit var fakeDirtyTracker: FakeEditorDirtyTracker
    private lateinit var fakeSyncPushEngine: FakeEditorSyncPushEngine
    private lateinit var fakeConnectivityMonitor: FakeEditorConnectivityMonitor
    private lateinit var fakeApiService: FakeEditorApiService
    private lateinit var fakeSettingsRepository: FakeEditorSettingsRepository
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        fakeChitDao = FakeEditorChitDao()
        fakeDirtyTracker = FakeEditorDirtyTracker()
        fakeSyncPushEngine = FakeEditorSyncPushEngine()
        fakeConnectivityMonitor = FakeEditorConnectivityMonitor()
        fakeApiService = FakeEditorApiService()
        fakeSettingsRepository = FakeEditorSettingsRepository()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // =========================================================================
    // Property 3: New chit creation invariants
    // =========================================================================
    //
    // *For any* new chit created via the editor, after save() completes:
    // 1. The saved entity in the DAO must have a valid UUID (non-blank, 36 chars)
    // 2. The entity must have isDirty=true
    // 3. All form fields set by the user must be persisted in the entity
    //
    // **Validates: Requirements 2.2**

    @Test
    fun `Property 3 - new chit has valid UUID after save`() = runTest {
        repeat(100) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            val form = generateRandomFormState(seed = i, id = viewModel.formState.value.id)
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val savedEntities = fakeChitDao.getAllEntities()
            assertEquals(
                "Iteration $i: exactly one entity should be saved",
                1,
                savedEntities.size
            )

            val savedEntity = savedEntities.first()
            assertTrue(
                "Iteration $i: saved entity ID should be a valid UUID format (36 chars with dashes)",
                savedEntity.id.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
            )
        }
    }

    @Test
    fun `Property 3 - new chit has isDirty true after save`() = runTest {
        repeat(100) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            val form = generateRandomFormState(seed = i, id = viewModel.formState.value.id)
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val savedEntity = fakeChitDao.getAllEntities().first()
            assertTrue(
                "Iteration $i: isDirty must be true for a newly created chit",
                savedEntity.isDirty
            )
        }
    }

    @Test
    fun `Property 3 - new chit persists all form fields`() = runTest {
        repeat(100) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            val form = generateRandomFormState(seed = i, id = viewModel.formState.value.id)
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val savedEntity = fakeChitDao.getAllEntities().first()

            // Verify all form fields are persisted correctly in the entity
            // title: blank → null, non-blank → value
            if (form.title.isBlank()) {
                assertNull("Iteration $i: blank title should be null in entity", savedEntity.title)
            } else {
                assertEquals("Iteration $i: title mismatch", form.title, savedEntity.title)
            }

            // note: blank → null, non-blank → value
            if (form.note.isBlank()) {
                assertNull("Iteration $i: blank note should be null in entity", savedEntity.note)
            } else {
                assertEquals("Iteration $i: note mismatch", form.note, savedEntity.note)
            }

            // tags: empty → null, non-empty → value
            if (form.tags.isEmpty()) {
                assertNull("Iteration $i: empty tags should be null in entity", savedEntity.tags)
            } else {
                assertEquals("Iteration $i: tags mismatch", form.tags, savedEntity.tags)
            }

            // people: empty → null, non-empty → value
            if (form.people.isEmpty()) {
                assertNull("Iteration $i: empty people should be null in entity", savedEntity.people)
            } else {
                assertEquals("Iteration $i: people mismatch", form.people, savedEntity.people)
            }

            // Nullable string fields pass through directly
            assertEquals("Iteration $i: startDatetime", form.startDatetime, savedEntity.startDatetime)
            assertEquals("Iteration $i: endDatetime", form.endDatetime, savedEntity.endDatetime)
            assertEquals("Iteration $i: dueDatetime", form.dueDatetime, savedEntity.dueDatetime)
            assertEquals("Iteration $i: pointInTime", form.pointInTime, savedEntity.pointInTime)
            assertEquals("Iteration $i: status", form.status, savedEntity.status)
            assertEquals("Iteration $i: priority", form.priority, savedEntity.priority)
            assertEquals("Iteration $i: checklist", form.checklist, savedEntity.checklist)
            assertEquals("Iteration $i: location", form.location, savedEntity.location)
            assertEquals("Iteration $i: color", form.color, savedEntity.color)
            assertEquals("Iteration $i: alerts", form.alerts, savedEntity.alerts)
            assertEquals("Iteration $i: recurrence", form.recurrence, savedEntity.recurrence)
            assertEquals("Iteration $i: recurrenceRule", form.recurrenceRule, savedEntity.recurrenceRule)
            assertEquals("Iteration $i: allDay", form.allDay, savedEntity.allDay)
            assertEquals("Iteration $i: timezone", form.timezone, savedEntity.timezone)
            assertEquals("Iteration $i: availability", form.availability, savedEntity.availability)
        }
    }

    @Test
    fun `Property 3 - new chit entity has syncVersion 0`() = runTest {
        repeat(50) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            val form = generateRandomFormState(seed = i, id = viewModel.formState.value.id)
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val savedEntity = fakeChitDao.getAllEntities().first()
            assertEquals(
                "Iteration $i: new chit syncVersion must be 0",
                0,
                savedEntity.syncVersion
            )
        }
    }

    // =========================================================================
    // Property 4: Dirty fields completeness on creation
    // =========================================================================
    //
    // *For any* new chit, after save() completes, the dirty fields set recorded
    // by the DirtyTracker SHALL contain all non-default fields from the form.
    // Specifically:
    // - Non-blank title → "title" in dirty fields
    // - Non-blank note → "note" in dirty fields
    // - Non-null dates → corresponding field name in dirty fields
    // - Non-empty tags → "tags" in dirty fields
    // - Non-empty people → "people" in dirty fields
    // - allDay=true → "all_day" in dirty fields
    // - Non-null status/priority/etc → field name in dirty fields
    //
    // **Validates: Requirements 2.3**

    @Test
    fun `Property 4 - dirty fields contain all non-default form fields on creation`() = runTest {
        repeat(100) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            val form = generateRandomFormState(seed = i, id = viewModel.formState.value.id)
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            // Get the dirty fields that were recorded by the tracker
            val chitId = viewModel.formState.value.id
            val recordedDirtyFields = fakeDirtyTracker.getDirtyFieldsFor(chitId)

            // Compute expected dirty fields using the same logic as detectChangedFields
            val expectedDirtyFields = detectChangedFields(null, form)

            assertEquals(
                "Iteration $i: dirty fields must match all non-default form fields",
                expectedDirtyFields,
                recordedDirtyFields
            )
        }
    }

    @Test
    fun `Property 4 - non-blank title appears in dirty fields`() = runTest {
        repeat(50) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            val form = ChitFormState(
                id = viewModel.formState.value.id,
                title = "Title $i",
                isNew = true
            )
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val chitId = viewModel.formState.value.id
            val recordedDirtyFields = fakeDirtyTracker.getDirtyFieldsFor(chitId)

            assertTrue(
                "Iteration $i: 'title' must be in dirty fields when title is non-blank",
                recordedDirtyFields.contains("title")
            )
        }
    }

    @Test
    fun `Property 4 - blank title does NOT appear in dirty fields`() = runTest {
        repeat(20) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            // Set a form with blank title but some other field populated
            val form = ChitFormState(
                id = viewModel.formState.value.id,
                title = "",
                note = "Some note $i",
                isNew = true
            )
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val chitId = viewModel.formState.value.id
            val recordedDirtyFields = fakeDirtyTracker.getDirtyFieldsFor(chitId)

            assertFalse(
                "Iteration $i: 'title' must NOT be in dirty fields when title is blank",
                recordedDirtyFields.contains("title")
            )
            assertTrue(
                "Iteration $i: 'note' must be in dirty fields when note is non-blank",
                recordedDirtyFields.contains("note")
            )
        }
    }

    @Test
    fun `Property 4 - all populated nullable fields appear in dirty fields`() = runTest {
        repeat(50) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            // Create a form with all nullable fields populated
            val form = ChitFormState(
                id = viewModel.formState.value.id,
                title = "Title",
                note = "Note",
                startDatetime = "2025-06-01T09:00:00Z",
                endDatetime = "2025-06-01T10:00:00Z",
                dueDatetime = "2025-06-02T17:00:00Z",
                pointInTime = "2025-06-01T12:00:00Z",
                status = "todo",
                priority = "high",
                tags = listOf("tag1"),
                checklist = "[{\"text\":\"item\"}]",
                people = listOf("Alice"),
                location = "NYC",
                color = "#FF0000",
                alerts = "[{\"minutes\":15}]",
                recurrence = "daily",
                recurrenceRule = "{\"freq\":\"DAILY\"}",
                allDay = true,
                timezone = "America/New_York",
                availability = "busy",
                isNew = true
            )
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val chitId = viewModel.formState.value.id
            val recordedDirtyFields = fakeDirtyTracker.getDirtyFieldsFor(chitId)

            // All fields should be present
            val expectedFields = setOf(
                "title", "note", "start_datetime", "end_datetime",
                "due_datetime", "point_in_time", "status", "priority",
                "tags", "checklist", "people", "location", "color",
                "alerts", "recurrence", "recurrence_rule", "all_day",
                "timezone", "availability"
            )

            assertEquals(
                "Iteration $i: all populated fields must appear in dirty fields",
                expectedFields,
                recordedDirtyFields
            )
        }
    }

    @Test
    fun `Property 4 - empty form produces empty dirty fields`() = runTest {
        repeat(20) { i ->
            fakeChitDao.clear()
            fakeDirtyTracker.clear()

            val viewModel = createNewChitViewModel()
            // Default form with all defaults (blank title, blank note, no dates, etc.)
            val form = ChitFormState(
                id = viewModel.formState.value.id,
                isNew = true
            )
            viewModel.updateForm(form)
            viewModel.save()
            advanceUntilIdle()

            val chitId = viewModel.formState.value.id
            val recordedDirtyFields = fakeDirtyTracker.getDirtyFieldsFor(chitId)

            assertTrue(
                "Iteration $i: empty form should produce empty dirty fields set",
                recordedDirtyFields.isEmpty()
            )
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Creates a ChitEditorViewModel in "new chit" mode.
     */
    private fun createNewChitViewModel(): ChitEditorViewModel {
        val savedStateHandle = SavedStateHandle(mapOf("chitId" to ChitEditorViewModel.NEW_CHIT_ID))
        return ChitEditorViewModel(
            chitDao = fakeChitDao,
            dirtyTracker = fakeDirtyTracker,
            syncPushEngine = fakeSyncPushEngine,
            connectivityMonitor = fakeConnectivityMonitor,
            apiService = fakeApiService,
            settingsRepository = fakeSettingsRepository,
            savedStateHandle = savedStateHandle
        )
    }

    /**
     * Generates a random ChitFormState with varied field values for property testing.
     * Uses a seed for reproducibility.
     */
    private fun generateRandomFormState(seed: Int, id: String): ChitFormState {
        val r = Random(seed)
        fun nullStr(): String? = if (r.nextBoolean()) "val_${r.nextInt(1000)}" else null
        fun nonBlankOrEmpty(): String = if (r.nextBoolean()) "text_${r.nextInt(1000)}" else ""
        fun nullStrList(): List<String> = if (r.nextBoolean()) List(r.nextInt(1, 4)) { "item_$it" } else emptyList()

        return ChitFormState(
            id = id,
            title = nonBlankOrEmpty(),
            note = nonBlankOrEmpty(),
            startDatetime = nullStr(),
            endDatetime = nullStr(),
            dueDatetime = nullStr(),
            pointInTime = nullStr(),
            status = nullStr(),
            priority = nullStr(),
            tags = nullStrList(),
            checklist = nullStr(),
            people = nullStrList(),
            location = nullStr(),
            color = nullStr(),
            alerts = nullStr(),
            recurrence = nullStr(),
            recurrenceRule = nullStr(),
            allDay = r.nextBoolean(),
            timezone = nullStr(),
            availability = nullStr(),
            isNew = true
        )
    }
}

// ─── Fake Implementations ─────────────────────────────────────────────────────

/**
 * Fake ChitDao for editor ViewModel tests.
 * Stores entities in-memory and supports the subset of DAO methods
 * used by ChitEditorViewModel.
 */
class FakeEditorChitDao : ChitDao {

    private val entities = mutableMapOf<String, ChitEntity>()

    fun clear() {
        entities.clear()
    }

    fun getAllEntities(): List<ChitEntity> = entities.values.toList()

    override suspend fun getById(id: String): ChitEntity? = entities[id]

    override suspend fun upsert(chit: ChitEntity) {
        entities[chit.id] = chit
    }

    override suspend fun upsertAll(chits: List<ChitEntity>) {
        chits.forEach { entities[it.id] = it }
    }

    override suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(isDirty = isDirty, dirtyFields = dirtyFields)
    }

    override suspend fun getDirtyChits(): List<ChitEntity> =
        entities.values.filter { it.isDirty }

    override suspend fun getDirtyCount(): Int =
        entities.values.count { it.isDirty }

    override suspend fun markDeleted(id: String, now: String) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(deleted = true, modifiedDatetime = now)
    }

    override suspend fun updateSyncVersion(id: String, version: Int) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(syncVersion = version)
    }

    override fun getTaskChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getTasksByStatus(status: String): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getNoteChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getCalendarChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> = flowOf(emptyList())
    override suspend fun getCount(): Int = entities.size
    override suspend fun getFirstFive(): List<ChitEntity> = entities.values.take(5)
    override suspend fun clearConflictFlag(id: String) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(hasUnviewedConflict = false, conflictFields = null)
    }
    override suspend fun setConflictState(id: String, fields: String) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(hasUnviewedConflict = true, conflictFields = fields)
    }
    override fun getChecklistChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getProjectMasterChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override suspend fun getChitsByIds(ids: List<String>): List<ChitEntity> =
        ids.mapNotNull { entities[it] }
    override fun getAlertChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getIndicatorChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override fun getLocationChits(): Flow<List<ChitEntity>> = flowOf(emptyList())
    override suspend fun markDirty(id: String, dirtyFields: String, now: String) {
        val entity = entities[id] ?: return
        entities[id] = entity.copy(isDirty = true, dirtyFields = dirtyFields, modifiedDatetime = now)
    }
    override suspend fun getChitsForDaySuspend(dayStart: String, dayEnd: String): List<ChitEntity> = emptyList()
    override suspend fun getUpcomingTasksSuspend(): List<ChitEntity> = emptyList()
    override suspend fun getChitsWithAlerts(): List<ChitEntity> = emptyList()
    override suspend fun getChitsWithTag(tag: String): List<ChitEntity> = emptyList()
    override suspend fun upsertWithoutDirty(chit: ChitEntity) {
        entities[chit.id] = chit
    }
}

/**
 * Fake DirtyTracker that records markDirty calls for verification.
 * Tracks which fields were marked dirty for each chit ID.
 */
class FakeEditorDirtyTracker : DirtyTracker {

    private val dirtyFieldsMap = mutableMapOf<String, MutableSet<String>>()

    fun clear() {
        dirtyFieldsMap.clear()
    }

    fun getDirtyFieldsFor(chitId: String): Set<String> =
        dirtyFieldsMap[chitId] ?: emptySet()

    override suspend fun markDirty(chitId: String, changedFields: Set<String>) {
        val existing = dirtyFieldsMap.getOrPut(chitId) { mutableSetOf() }
        existing.addAll(changedFields)
    }

    override suspend fun clearDirty(chitId: String) {
        dirtyFieldsMap.remove(chitId)
    }

    override suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity) {
        dirtyFieldsMap.remove(chitId)
    }

    override suspend fun markContactDirty(contactId: String, changedFields: Set<String>) {}
    override suspend fun clearContactDirty(contactId: String) {}
    override suspend fun markSettingsDirty() {}
    override suspend fun clearSettingsDirty() {}
}

/**
 * Fake SyncPushEngine that records push calls without performing network operations.
 */
class FakeEditorSyncPushEngine : SyncPushEngine {

    val pushedChitIds = mutableListOf<String>()

    override suspend fun pushSingle(chitId: String): PushResult {
        pushedChitIds.add(chitId)
        return PushResult.Success(1)
    }

    override suspend fun pushAll(): PushResult {
        return PushResult.Success(1)
    }
}

/**
 * Fake ConnectivityMonitor that defaults to offline (no push triggered).
 * Can be configured to report online for testing push behavior.
 */
class FakeEditorConnectivityMonitor(isOnlineInitial: Boolean = false) : ConnectivityMonitor {

    private val _isOnline = MutableStateFlow(isOnlineInitial)
    override val isOnline: StateFlow<Boolean> = _isOnline

    override val events: Flow<ConnectivityEvent> = flowOf()

    fun setOnline(online: Boolean) {
        _isOnline.value = online
    }
}

/**
 * Fake CwocApiService for editor ViewModel tests.
 * Returns empty/success responses for all methods.
 */
class FakeEditorApiService : CwocApiService {
    override suspend fun authenticate(request: DeviceTokenRequest): Response<DeviceTokenResponse> {
        throw NotImplementedError("Not needed for editor tests")
    }

    override suspend fun getSyncChanges(since: Int, include: String): Response<SyncResponseDto> {
        throw NotImplementedError("Not needed for editor tests")
    }

    override suspend fun pushChanges(request: SyncPushRequestDto): Response<SyncPushResponseDto> {
        throw NotImplementedError("Not needed for editor tests")
    }

    override suspend fun postClientLog(entry: ClientLogRequest): Response<ClientLogResponse> {
        throw NotImplementedError("Not needed for editor tests")
    }

    override suspend fun dismissConflict(chitId: String): Response<Unit> {
        return Response.success(Unit)
    }

    override suspend fun downloadAttachment(attachmentId: String): Response<ResponseBody> {
        throw NotImplementedError("Not needed for editor tests")
    }

    override suspend fun uploadAttachment(
        chitId: RequestBody,
        filename: RequestBody,
        mimeType: RequestBody,
        file: MultipartBody.Part
    ): Response<AttachmentUploadResponse> {
        throw NotImplementedError("Not needed for editor tests")
    }
}

/**
 * Fake SettingsRepository for editor ViewModel tests.
 * Returns a default SettingsEntity with standard values.
 */
class FakeEditorSettingsRepository : SettingsRepository {
    override val settings: Flow<SettingsEntity> = flowOf(
        SettingsEntity(
            userId = "test-user",
            timeFormat = "12h",
            sex = null,
            snoozeLength = "10",
            defaultFilters = null,
            alarmOrientation = null,
            activeClocks = null,
            savedLocations = null,
            tags = null,
            customColors = null,
            visualIndicators = null,
            chitOptions = null,
            calendarSnap = "15",
            weekStartDay = "sunday",
            workStartHour = null,
            workEndHour = null,
            workDays = null,
            enabledPeriods = null,
            customDaysCount = null,
            allViewStartHour = null,
            allViewEndHour = null,
            dayScrollToHour = null,
            username = null,
            unitSystem = null,
            habitsSuccessWindow = null,
            overdueBorderColor = null,
            blockedBorderColor = null,
            hidDeclined = null,
            defaultShowHabitsOnCalendar = null,
            defaultTimezone = "America/New_York",
            defaultView = "Tasks",
            viewOrder = null,
            syncVersion = 0,
            lastSyncedAt = null
        )
    )

    override suspend fun get(): SettingsEntity? = SettingsEntity(
        userId = "test-user",
        timeFormat = "12h",
        sex = null,
        snoozeLength = "10",
        defaultFilters = null,
        alarmOrientation = null,
        activeClocks = null,
        savedLocations = null,
        tags = null,
        customColors = null,
        visualIndicators = null,
        chitOptions = null,
        calendarSnap = "15",
        weekStartDay = "sunday",
        workStartHour = null,
        workEndHour = null,
        workDays = null,
        enabledPeriods = null,
        customDaysCount = null,
        allViewStartHour = null,
        allViewEndHour = null,
        dayScrollToHour = null,
        username = null,
        unitSystem = null,
        habitsSuccessWindow = null,
        overdueBorderColor = null,
        blockedBorderColor = null,
        hidDeclined = null,
        defaultShowHabitsOnCalendar = null,
        defaultTimezone = "America/New_York",
        defaultView = "Tasks",
        viewOrder = null,
        syncVersion = 0,
        lastSyncedAt = null
    )

    override suspend fun update(settings: SettingsEntity) {}
    override suspend fun replaceWithServerVersion(settings: SettingsEntity) {}
    override suspend fun clearDirty() {}
}
