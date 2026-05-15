# Design: Android Phase 2 — Offline CRUD + Live Sync

## Overview

This design covers the architecture for Phase 2 of the CWOC Android app: full offline create/edit/delete with optimistic push, dirty tracking, WebSocket-based live sync, and connectivity-aware background sync. It builds directly on the Phase 1 architecture (Room, Retrofit, Hilt, Compose, single-Activity) and extends it with new components rather than replacing existing ones.

The app lives at `/android/` in the workspace root. All code is Kotlin targeting API 26+.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CWOC Android App — Phase 2                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  UI Layer (Jetpack Compose)                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Tasks   │ │  Notes   │ │ Calendar │ │  Editor  │ │ SyncStateIndicator│  │
│  │  Screen  │ │  Screen  │ │  Screen  │ │  Screen  │ │ (top app bar)    │  │
│  │  + FAB   │ │  + FAB   │ │  + FAB   │ │  (new)   │ │  (new)           │  │
│  │  + Swipe │ │  + Swipe │ │          │ │          │ │                   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────────────┘  │
│       │             │            │             │             │                │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴──────────┐ │                │
│  │  Tasks   │ │  Notes   │ │ Calendar │ │   Editor      │ │                │
│  │ViewModel │ │ViewModel │ │ViewModel │ │  ViewModel    │ │                │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬──────────┘ │                │
│       │             │            │             │             │                │
│  ─────┼─────────────┼────────────┼─────────────┼─────────────┼────────────── │
│       │             │            │             │             │                │
│  Data Layer                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                      Repositories                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │    │
│  │  │ ChitRepo    │  │ SyncRepo    │  │ ConnectivityRepo            │  │    │
│  │  │ (CRUD,      │  │ (push/pull, │  │ (network state,             │  │    │
│  │  │  dirty mgmt)│  │  HWM, state)│  │  Flow<Boolean>)             │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────────────────────┘  │    │
│  └─────────┼────────────────┼────────────────┼──────────────────────────┘    │
│            │                │                │                                │
│  ┌─────────┴────┐  ┌───────┴────────────────┴───────────────────────┐       │
│  │ Room DB v2   │  │ Sync Infrastructure                             │       │
│  │ (+ is_dirty, │  │ ┌──────────────┐ ┌────────────┐ ┌───────────┐ │       │
│  │  dirty_fields)│  │ │SyncPushEngine│ │ WebSocket  │ │Connectivity│ │       │
│  └──────────────┘  │ │  (new)       │ │ Client     │ │ Monitor   │ │       │
│                     │ └──────┬───────┘ │ (new)      │ │ (new)     │ │       │
│                     │        │         └─────┬──────┘ └─────┬─────┘ │       │
│                     │ ┌──────┴───────┐       │              │       │       │
│                     │ │ SyncWorker   │       │              │       │       │
│                     │ │ (extended)   │◄──────┴──────────────┘       │       │
│                     │ └──────────────┘                               │       │
│                     └────────────────────────────────────────────────┘       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
         │                    │
         │  HTTPS             │  WebSocket
         ▼                    ▼
┌─────────────────────────────────────┐
│   CWOC Server (FastAPI)             │
│                                     │
│ GET  /api/sync/changes?since={v}    │
│ POST /api/sync/push                 │
│ WS   /ws/sync                       │
└─────────────────────────────────────┘
```

### Key Architectural Decisions (Phase 2 Additions)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dirty tracking | Column-level (`is_dirty` + `dirty_fields` JSON) | Enables field-level merge on server; minimal schema change |
| Push strategy | Optimistic (fire-and-forget from UI perspective) | User never waits for server; dirty flag handles failures |
| WebSocket library | OkHttp WebSocket (already in dependency tree) | No new dependency; integrates with existing OkHttp client |
| Connectivity | ConnectivityManager NetworkCallback | Official Android API; reliable on API 26+ |
| Background sync | WorkManager one-shot expedited job | Survives app kill; respects battery; immediate on reconnect |
| Entity-to-DTO mapping | Explicit mapper functions (reverse of Phase 1) | Type-safe, testable, mirrors existing DTO-to-Entity pattern |
| Form state | Dedicated `ChitFormState` data class in ViewModel | Decouples UI state from entity; enables dirty comparison |
| Sync state | `StateFlow<SyncState>` enum in SyncRepository | Single source of truth for UI indicator; reactive |



## Components and Interfaces

### New Components (Phase 2)

| Component | Responsibility | Interface |
|-----------|---------------|-----------|
| `ChitEditorViewModel` | Manages form state, save/discard, dirty detection | `save()`, `discard()`, `updateField()` |
| `DirtyTracker` | Sets `is_dirty`, manages `dirty_fields` array | `markDirty(entity, changedFields)`, `clearDirty(id)` |
| `SyncPushEngine` | Pushes dirty records to server, handles responses | `pushDirtyRecords()`, `pushSingle(id)` |
| `WebSocketClient` | Maintains `/ws/sync` connection, emits notifications | `connect()`, `disconnect()`, `messages: Flow<SyncNotification>` |
| `ConnectivityMonitor` | Observes network state via ConnectivityManager | `isOnline: StateFlow<Boolean>`, `events: Flow<ConnectivityEvent>` |
| `PushSyncWorker` | WorkManager job: flush dirty queue on reconnect | `doWork(): Result` |
| `SyncStateManager` | Aggregates sync/connectivity into single state | `syncState: StateFlow<SyncState>` |

### Extended Components (from Phase 1)

| Component | Phase 2 Changes |
|-----------|----------------|
| `ChitDao` | Add `getDirtyChits()`, `insert()`, `update()`, `markDeleted()` queries |
| `ChitRepository` | Add `create()`, `update()`, `softDelete()` methods |
| `CwocDatabase` | Bump to version 2, add migration |
| `ChitEntity` | Add `isDirty: Boolean`, `dirtyFields: String?` columns |
| `CwocApiService` | Add `pushChanges()` endpoint |
| `SyncEngine` | Integrate with `SyncPushEngine` for push-then-pull flow |
| `CwocNavGraph` | Add `Editor` route with chit ID argument |
| `TasksScreen` / `NotesScreen` | Add FAB, swipe-to-delete |

### Key Interfaces

```kotlin
// Push API contract (new in Phase 2)
interface CwocApiService {
    // ... existing Phase 1 methods ...

    @POST("/api/sync/push")
    suspend fun pushChanges(
        @Body request: SyncPushRequestDto
    ): Response<SyncPushResponseDto>
}

// Dirty tracking
interface DirtyTracker {
    suspend fun markDirty(chitId: String, changedFields: Set<String>)
    suspend fun clearDirty(chitId: String)
    suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity)
}

// Connectivity
interface ConnectivityMonitor {
    val isOnline: StateFlow<Boolean>
    val events: Flow<ConnectivityEvent>
}

sealed class ConnectivityEvent {
    object Online : ConnectivityEvent()
    object Offline : ConnectivityEvent()
}

// Sync state for UI
enum class SyncState {
    ONLINE_IDLE,      // Green dot — connected, WebSocket active, nothing pending
    SYNCING,          // Orange dot — actively pushing or pulling
    OFFLINE           // Red dot — no network
}

// WebSocket
interface WebSocketClient {
    val messages: Flow<SyncNotification>
    val isConnected: StateFlow<Boolean>
    fun connect()
    fun disconnect()
}

data class SyncNotification(
    val type: String,       // "changes_available"
    val serverVersion: Int
)

// Push engine
interface SyncPushEngine {
    suspend fun pushSingle(chitId: String): PushResult
    suspend fun pushAll(): PushResult
}

sealed class PushResult {
    data class Success(val serverVersion: Int) : PushResult()
    data class Partial(val successes: Int, val failures: Int) : PushResult()
    data class NetworkError(val message: String) : PushResult()
}
```

## Data Models

### ChitEntity v2 (Extended)

Two new columns added via Room migration:

```kotlin
@Entity(tableName = "chits")
data class ChitEntity(
    // ... all existing Phase 1 fields unchanged ...
    @PrimaryKey val id: String,
    val title: String?,
    val note: String?,
    // ... (full field list in Phase 1 design) ...
    val syncVersion: Int,
    val lastSyncedAt: String?,

    // NEW in Phase 2 — dirty tracking
    val isDirty: Boolean = false,
    val dirtyFields: String? = "[]"   // JSON array of field names, e.g. ["title","note"]
)
```

### ChitFormState (New — Editor ViewModel)

Decoupled from the entity to allow dirty comparison:

```kotlin
data class ChitFormState(
    val id: String,
    val title: String = "",
    val note: String = "",
    val startDatetime: String? = null,
    val endDatetime: String? = null,
    val dueDatetime: String? = null,
    val pointInTime: String? = null,
    val status: String? = null,
    val priority: String? = null,
    val tags: List<String> = emptyList(),
    val checklist: String? = null,
    val people: List<String> = emptyList(),
    val location: String? = null,
    val color: String? = null,
    val alerts: String? = null,
    val recurrence: String? = null,
    val recurrenceRule: String? = null,
    val allDay: Boolean = false,
    val timezone: String? = null,
    val availability: String? = null,
    val isNew: Boolean = false
)
```

### Push DTOs (New — Entity-to-DTO for outbound)

```kotlin
data class SyncPushRequestDto(
    val chits: List<ChitPushDto>
)

data class ChitPushDto(
    val id: String,
    val last_known_sync_version: Int,
    val title: String?,
    val note: String?,
    val tags: List<String>?,
    val start_datetime: String?,
    val end_datetime: String?,
    val due_datetime: String?,
    val point_in_time: String?,
    val completed_datetime: String?,
    val status: String?,
    val priority: String?,
    val severity: String?,
    val checklist: Any?,
    val alarm: Boolean?,
    val notification: Boolean?,
    val recurrence: String?,
    val recurrence_id: String?,
    val recurrence_rule: Any?,
    val recurrence_exceptions: Any?,
    val location: String?,
    val color: String?,
    val people: List<String>?,
    val pinned: Boolean?,
    val archived: Boolean?,
    val deleted: Boolean?,
    val created_datetime: String?,
    val modified_datetime: String?,
    val is_project_master: Boolean?,
    val child_chits: List<String>?,
    val all_day: Boolean?,
    val timezone: String?,
    val alerts: Any?,
    val progress_percent: Int?,
    val time_estimate: String?,
    val weather_data: Any?,
    val health_data: Any?,
    val habit: Boolean?,
    val habit_goal: Int?,
    val habit_success: Int?,
    val show_on_calendar: Boolean?,
    val habit_reset_period: String?,
    val habit_last_action_date: String?,
    val habit_hide_overall: Boolean?,
    val perpetual: Boolean?,
    val shares: Any?,
    val stealth: Boolean?,
    val assigned_to: String?,
    val owner_id: String?,
    val availability: String?,
    val snoozed_until: String?,
    val prerequisites: List<String>?
)

data class SyncPushResponseDto(
    val results: PushResultsDto,
    val server_version: Int
)

data class PushResultsDto(
    val chits: List<ChitPushResultDto>?
)

data class ChitPushResultDto(
    val id: String,
    val status: String,              // "accepted", "created", "merged", "error"
    val sync_version: Int?,
    val conflict_fields: List<String>?,
    // For "merged" status — server returns the merged entity
    val merged: ChitDto?
)
```

### Entity-to-DTO Mapper (Reverse of Phase 1)

```kotlin
fun ChitEntity.toPushDto(): ChitPushDto {
    val gson = Gson()
    return ChitPushDto(
        id = id,
        last_known_sync_version = syncVersion,
        title = title,
        note = note,
        tags = tags,
        start_datetime = startDatetime,
        end_datetime = endDatetime,
        due_datetime = dueDatetime,
        point_in_time = pointInTime,
        completed_datetime = completedDatetime,
        status = status,
        priority = priority,
        severity = severity,
        checklist = checklist?.let { gson.fromJson(it, Any::class.java) },
        alarm = alarm,
        notification = notification,
        recurrence = recurrence,
        recurrence_id = recurrenceId,
        recurrence_rule = recurrenceRule?.let { gson.fromJson(it, Any::class.java) },
        recurrence_exceptions = recurrenceExceptions?.let { gson.fromJson(it, Any::class.java) },
        location = location,
        color = color,
        people = people,
        pinned = pinned,
        archived = archived,
        deleted = deleted,
        created_datetime = createdDatetime,
        modified_datetime = modifiedDatetime,
        is_project_master = isProjectMaster,
        child_chits = childChits,
        all_day = allDay,
        timezone = timezone,
        alerts = alerts?.let { gson.fromJson(it, Any::class.java) },
        progress_percent = progressPercent,
        time_estimate = timeEstimate,
        weather_data = weatherData?.let { gson.fromJson(it, Any::class.java) },
        health_data = healthData?.let { gson.fromJson(it, Any::class.java) },
        habit = habit,
        habit_goal = habitGoal,
        habit_success = habitSuccess,
        show_on_calendar = showOnCalendar,
        habit_reset_period = habitResetPeriod,
        habit_last_action_date = habitLastActionDate,
        habit_hide_overall = habitHideOverall,
        perpetual = perpetual,
        shares = shares?.let { gson.fromJson(it, Any::class.java) },
        stealth = stealth,
        assigned_to = assignedTo,
        owner_id = ownerId,
        availability = availability,
        snoozed_until = snoozedUntil,
        prerequisites = prerequisites
    )
}
```


## Database Migration (v1 → v2)

### Migration Implementation

```kotlin
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
            "ALTER TABLE chits ADD COLUMN isDirty INTEGER NOT NULL DEFAULT 0"
        )
        database.execSQL(
            "ALTER TABLE chits ADD COLUMN dirtyFields TEXT DEFAULT '[]'"
        )
    }
}
```

### Database Builder Update

```kotlin
@Provides
@Singleton
fun provideCwocDatabase(
    @ApplicationContext context: Context
): CwocDatabase {
    return Room.databaseBuilder(
        context,
        CwocDatabase::class.java,
        "cwoc.db"
    )
    .addMigrations(MIGRATION_1_2)
    .build()
}
```

### CwocDatabase v2

```kotlin
@Database(
    entities = [ChitEntity::class, ContactEntity::class, SettingsEntity::class, SyncMetadataEntity::class],
    version = 2,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class CwocDatabase : RoomDatabase() {
    abstract fun chitDao(): ChitDao
    abstract fun contactDao(): ContactDao
    abstract fun settingsDao(): SettingsDao
    abstract fun syncMetadataDao(): SyncMetadataDao
}
```

The migration adds two columns with safe defaults:
- `isDirty` defaults to `0` (false) — existing records have no local changes
- `dirtyFields` defaults to `'[]'` — empty JSON array, no fields pending

All existing data is preserved. No data transformation is needed.


## Dirty Tracking System

### DirtyTracker Implementation

```kotlin
class DirtyTrackerImpl @Inject constructor(
    private val chitDao: ChitDao
) : DirtyTracker {

    override suspend fun markDirty(chitId: String, changedFields: Set<String>) {
        val entity = chitDao.getById(chitId) ?: return
        val existingFields = parseDirtyFields(entity.dirtyFields)
        val mergedFields = existingFields + changedFields  // Set union — no duplicates
        chitDao.updateDirtyState(
            id = chitId,
            isDirty = true,
            dirtyFields = serializeDirtyFields(mergedFields)
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
        // Replace local entity with server-merged version, clear dirty state
        val cleanEntity = mergedEntity.copy(isDirty = false, dirtyFields = "[]")
        chitDao.upsert(cleanEntity)
    }

    private fun parseDirtyFields(json: String?): Set<String> {
        if (json.isNullOrBlank() || json == "[]") return emptySet()
        val gson = Gson()
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson<List<String>>(json, type).toSet()
    }

    private fun serializeDirtyFields(fields: Set<String>): String {
        return Gson().toJson(fields.toList())
    }
}
```

### Dirty Field Detection (Form → Entity Comparison)

```kotlin
fun detectChangedFields(original: ChitEntity?, form: ChitFormState): Set<String> {
    if (original == null) {
        // New chit — all non-null/non-default fields are dirty
        return buildSet {
            if (form.title.isNotBlank()) add("title")
            if (form.note.isNotBlank()) add("note")
            if (form.startDatetime != null) add("start_datetime")
            if (form.endDatetime != null) add("end_datetime")
            if (form.dueDatetime != null) add("due_datetime")
            if (form.pointInTime != null) add("point_in_time")
            if (form.status != null) add("status")
            if (form.priority != null) add("priority")
            if (form.tags.isNotEmpty()) add("tags")
            if (form.checklist != null) add("checklist")
            if (form.people.isNotEmpty()) add("people")
            if (form.location != null) add("location")
            if (form.color != null) add("color")
            if (form.alerts != null) add("alerts")
            if (form.recurrence != null) add("recurrence")
            if (form.recurrenceRule != null) add("recurrence_rule")
            if (form.allDay) add("all_day")
            if (form.timezone != null) add("timezone")
            if (form.availability != null) add("availability")
        }
    }

    // Existing chit — compare field by field
    return buildSet {
        if (form.title != (original.title ?: "")) add("title")
        if (form.note != (original.note ?: "")) add("note")
        if (form.startDatetime != original.startDatetime) add("start_datetime")
        if (form.endDatetime != original.endDatetime) add("end_datetime")
        if (form.dueDatetime != original.dueDatetime) add("due_datetime")
        if (form.pointInTime != original.pointInTime) add("point_in_time")
        if (form.status != original.status) add("status")
        if (form.priority != original.priority) add("priority")
        if (form.tags != (original.tags ?: emptyList())) add("tags")
        if (form.checklist != original.checklist) add("checklist")
        if (form.people != (original.people ?: emptyList())) add("people")
        if (form.location != original.location) add("location")
        if (form.color != original.color) add("color")
        if (form.alerts != original.alerts) add("alerts")
        if (form.recurrence != original.recurrence) add("recurrence")
        if (form.recurrenceRule != original.recurrenceRule) add("recurrence_rule")
        if (form.allDay != original.allDay) add("all_day")
        if (form.timezone != original.timezone) add("timezone")
        if (form.availability != original.availability) add("availability")
    }
}
```

### ChitDao Extensions (Phase 2)

```kotlin
@Dao
interface ChitDao {
    // ... existing Phase 1 queries ...

    @Query("SELECT * FROM chits WHERE isDirty = 1")
    suspend fun getDirtyChits(): List<ChitEntity>

    @Query("SELECT COUNT(*) FROM chits WHERE isDirty = 1")
    suspend fun getDirtyCount(): Int

    @Query("UPDATE chits SET isDirty = :isDirty, dirtyFields = :dirtyFields WHERE id = :id")
    suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(chit: ChitEntity)

    @Query("UPDATE chits SET deleted = 1, modifiedDatetime = :now WHERE id = :id")
    suspend fun markDeleted(id: String, now: String)

    @Query("UPDATE chits SET syncVersion = :version WHERE id = :id")
    suspend fun updateSyncVersion(id: String, version: Int)
}
```


## Chit Editor Screen Architecture

### Navigation Route

```kotlin
sealed class Screen(val route: String) {
    // ... existing routes ...
    object Editor : Screen("editor/{chitId}") {
        fun createRoute(chitId: String) = "editor/$chitId"
        const val NEW_CHIT_ID = "new"
    }
}

// In CwocNavGraph:
composable(
    route = "editor/{chitId}",
    arguments = listOf(navArgument("chitId") { type = NavType.StringType })
) { backStackEntry ->
    val chitId = backStackEntry.arguments?.getString("chitId") ?: return@composable
    ChitEditorScreen(
        chitId = chitId,
        onNavigateBack = { navController.popBackStack() }
    )
}
```

### ChitEditorViewModel

```kotlin
@HiltViewModel
class ChitEditorViewModel @Inject constructor(
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val chitId: String = savedStateHandle["chitId"] ?: Screen.Editor.NEW_CHIT_ID
    private val isNew: Boolean = chitId == Screen.Editor.NEW_CHIT_ID

    private var originalEntity: ChitEntity? = null

    private val _formState = MutableStateFlow(ChitFormState(id = if (isNew) UUID.randomUUID().toString() else chitId, isNew = isNew))
    val formState: StateFlow<ChitFormState> = _formState.asStateFlow()

    private val _uiState = MutableStateFlow(EditorUiState())
    val uiState: StateFlow<EditorUiState> = _uiState.asStateFlow()

    init {
        if (!isNew) {
            loadExistingChit()
        }
    }

    private fun loadExistingChit() {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId)
            if (entity != null) {
                originalEntity = entity
                _formState.value = entity.toFormState()
            } else {
                _uiState.update { it.copy(error = "Chit not found") }
            }
        }
    }

    fun updateField(updater: (ChitFormState) -> ChitFormState) {
        _formState.update(updater)
    }

    fun save(onComplete: () -> Unit) {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()

            val changedFields = detectChangedFields(originalEntity, form)
            if (changedFields.isEmpty() && !isNew) {
                // No changes — just navigate back
                onComplete()
                return@launch
            }

            val entity = form.toEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )

            // Persist to Room
            chitDao.upsert(entity)

            // Mark dirty
            dirtyTracker.markDirty(entity.id, changedFields)

            // Optimistic push if online
            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch {
                    syncPushEngine.pushSingle(entity.id)
                }
            }

            onComplete()
        }
    }

    fun discard(onComplete: () -> Unit) {
        // No DB writes — just navigate back
        onComplete()
    }
}

data class EditorUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null
)
```

### Form-to-Entity Mapping

```kotlin
fun ChitFormState.toEntity(
    originalEntity: ChitEntity?,
    modifiedDatetime: String,
    createdDatetime: String?
): ChitEntity {
    return ChitEntity(
        id = id,
        title = title.ifBlank { null },
        note = note.ifBlank { null },
        tags = tags.ifEmpty { null },
        startDatetime = startDatetime,
        endDatetime = endDatetime,
        dueDatetime = dueDatetime,
        pointInTime = pointInTime,
        completedDatetime = originalEntity?.completedDatetime,
        status = status,
        priority = priority,
        severity = originalEntity?.severity,
        checklist = checklist,
        alarm = originalEntity?.alarm,
        notification = originalEntity?.notification,
        recurrence = recurrence,
        recurrenceId = originalEntity?.recurrenceId,
        recurrenceRule = recurrenceRule,
        recurrenceExceptions = originalEntity?.recurrenceExceptions,
        location = location,
        color = color,
        people = people.ifEmpty { null },
        pinned = originalEntity?.pinned ?: false,
        archived = originalEntity?.archived ?: false,
        deleted = originalEntity?.deleted ?: false,
        createdDatetime = createdDatetime,
        modifiedDatetime = modifiedDatetime,
        isProjectMaster = originalEntity?.isProjectMaster ?: false,
        childChits = originalEntity?.childChits,
        allDay = allDay,
        timezone = timezone,
        alerts = alerts,
        progressPercent = originalEntity?.progressPercent,
        timeEstimate = originalEntity?.timeEstimate,
        weatherData = originalEntity?.weatherData,
        healthData = originalEntity?.healthData,
        habit = originalEntity?.habit ?: false,
        habitGoal = originalEntity?.habitGoal,
        habitSuccess = originalEntity?.habitSuccess,
        showOnCalendar = originalEntity?.showOnCalendar,
        habitResetPeriod = originalEntity?.habitResetPeriod,
        habitLastActionDate = originalEntity?.habitLastActionDate,
        habitHideOverall = originalEntity?.habitHideOverall,
        perpetual = originalEntity?.perpetual ?: false,
        shares = originalEntity?.shares,
        stealth = originalEntity?.stealth,
        assignedTo = originalEntity?.assignedTo,
        ownerId = originalEntity?.ownerId,
        hasUnviewedConflict = originalEntity?.hasUnviewedConflict ?: false,
        availability = availability,
        snoozedUntil = originalEntity?.snoozedUntil,
        prerequisites = originalEntity?.prerequisites,
        syncVersion = originalEntity?.syncVersion ?: 0,
        lastSyncedAt = originalEntity?.lastSyncedAt,
        isDirty = true,
        dirtyFields = "[]"  // Will be set by DirtyTracker
    )
}

fun ChitEntity.toFormState(): ChitFormState {
    return ChitFormState(
        id = id,
        title = title ?: "",
        note = note ?: "",
        startDatetime = startDatetime,
        endDatetime = endDatetime,
        dueDatetime = dueDatetime,
        pointInTime = pointInTime,
        status = status,
        priority = priority,
        tags = tags ?: emptyList(),
        checklist = checklist,
        people = people ?: emptyList(),
        location = location,
        color = color,
        alerts = alerts,
        recurrence = recurrence,
        recurrenceRule = recurrenceRule,
        allDay = allDay,
        timezone = timezone,
        availability = availability,
        isNew = false
    )
}
```


## Sync Push Engine

### SyncPushEngineImpl

```kotlin
class SyncPushEngineImpl @Inject constructor(
    private val apiService: CwocApiService,
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val syncMetadataDao: SyncMetadataDao,
    private val syncStateManager: SyncStateManager
) : SyncPushEngine {

    override suspend fun pushSingle(chitId: String): PushResult {
        val entity = chitDao.getById(chitId) ?: return PushResult.NetworkError("Chit not found")
        if (!entity.isDirty) return PushResult.Success(entity.syncVersion)
        return pushEntities(listOf(entity))
    }

    override suspend fun pushAll(): PushResult {
        val dirtyChits = chitDao.getDirtyChits()
        if (dirtyChits.isEmpty()) return PushResult.Success(0)
        return pushEntities(dirtyChits)
    }

    private suspend fun pushEntities(entities: List<ChitEntity>): PushResult {
        syncStateManager.setSyncing()

        val request = SyncPushRequestDto(
            chits = entities.map { it.toPushDto() }
        )

        try {
            val response = apiService.pushChanges(request)

            if (!response.isSuccessful) {
                syncStateManager.setIdle()
                return PushResult.NetworkError("HTTP ${response.code()}")
            }

            val body = response.body() ?: return PushResult.NetworkError("Empty response")

            var successes = 0
            var failures = 0

            body.results.chits?.forEach { result ->
                when (result.status) {
                    "accepted", "created" -> {
                        dirtyTracker.clearDirty(result.id)
                        result.sync_version?.let { version ->
                            chitDao.updateSyncVersion(result.id, version)
                        }
                        successes++
                    }
                    "merged" -> {
                        // Server returns merged entity — update local with merged values
                        result.merged?.let { mergedDto ->
                            val mergedEntity = mergedDto.toEntity(Instant.now().toString())
                            dirtyTracker.clearDirtyWithMerge(result.id, mergedEntity)
                        } ?: run {
                            // Fallback: just clear dirty and update version
                            dirtyTracker.clearDirty(result.id)
                            result.sync_version?.let { version ->
                                chitDao.updateSyncVersion(result.id, version)
                            }
                        }
                        successes++
                    }
                    "error" -> {
                        // Retain dirty state — will retry later
                        failures++
                    }
                }
            }

            // Update high-water mark
            syncMetadataDao.updateHighWaterMark(
                body.server_version,
                Instant.now().toString()
            )

            syncStateManager.setIdle()

            return if (failures == 0) {
                PushResult.Success(body.server_version)
            } else {
                PushResult.Partial(successes, failures)
            }

        } catch (e: Exception) {
            syncStateManager.setIdle()
            // Network failure — dirty state preserved automatically (no clearDirty called)
            return PushResult.NetworkError(e.message ?: "Unknown error")
        }
    }
}
```

### Push Flow Diagram

```
User saves edit
    │
    ├─ Persist to Room (immediate)
    ├─ Mark dirty (DirtyTracker)
    ├─ Navigate back (optimistic success)
    │
    └─ Background coroutine:
        │
        ├─ Is online? ──No──→ Done (dirty state preserved for WorkManager)
        │
        └─ Yes → SyncPushEngine.pushSingle(id)
                    │
                    ├─ POST /api/sync/push
                    │
                    ├─ "accepted"/"created" → clearDirty + update syncVersion
                    ├─ "merged" → update entity with merged values + clearDirty
                    └─ "error" or network failure → retain dirty (retry later)
```


## WebSocket Client

### WebSocketClientImpl (OkHttp)

```kotlin
class WebSocketClientImpl @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val prefs: SharedPreferences,
    private val syncEngine: SyncEngine,
    private val syncMetadataDao: SyncMetadataDao
) : WebSocketClient {

    private var webSocket: WebSocket? = null
    private var reconnectAttempt = 0
    private val maxReconnectDelay = 60_000L  // 60 seconds max

    private val _messages = MutableSharedFlow<SyncNotification>()
    override val messages: Flow<SyncNotification> = _messages.asSharedFlow()

    private val _isConnected = MutableStateFlow(false)
    override val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun connect() {
        val serverUrl = prefs.getString("server_url", null) ?: return
        val token = prefs.getString("device_token", null) ?: return

        val wsUrl = serverUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://") + "/ws/sync"

        val request = Request.Builder()
            .url(wsUrl)
            .header("Authorization", "Bearer $token")
            .build()

        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _isConnected.value = true
                reconnectAttempt = 0
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                scope.launch {
                    val notification = parseNotification(text)
                    if (notification != null) {
                        _messages.emit(notification)
                        // Trigger incremental pull
                        performIncrementalPull()
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _isConnected.value = false
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
            }
        })
    }

    override fun disconnect() {
        webSocket?.close(1000, "Client disconnecting")
        webSocket = null
        _isConnected.value = false
    }

    private fun scheduleReconnect() {
        reconnectAttempt++
        val delay = minOf(
            1000L * (1L shl minOf(reconnectAttempt, 6)),  // Exponential: 2s, 4s, 8s, 16s, 32s, 64s
            maxReconnectDelay
        )
        scope.launch {
            delay(delay)
            connect()
        }
    }

    private suspend fun performIncrementalPull() {
        val hwm = syncMetadataDao.getMetadata()?.highWaterMark ?: 0
        syncEngine.performSync(since = hwm)
    }

    private fun parseNotification(text: String): SyncNotification? {
        return try {
            Gson().fromJson(text, SyncNotification::class.java)
        } catch (e: Exception) {
            null
        }
    }
}
```


## Connectivity Monitor

### ConnectivityMonitorImpl

```kotlin
class ConnectivityMonitorImpl @Inject constructor(
    @ApplicationContext private val context: Context
) : ConnectivityMonitor {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isOnline = MutableStateFlow(checkCurrentConnectivity())
    override val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _events = MutableSharedFlow<ConnectivityEvent>(replay = 0)
    override val events: Flow<ConnectivityEvent> = _events.asSharedFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            val wasOffline = !_isOnline.value
            _isOnline.value = true
            if (wasOffline) {
                CoroutineScope(Dispatchers.Main).launch {
                    _events.emit(ConnectivityEvent.Online)
                }
            }
        }

        override fun onLost(network: Network) {
            _isOnline.value = false
            CoroutineScope(Dispatchers.Main).launch {
                _events.emit(ConnectivityEvent.Offline)
            }
        }
    }

    init {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
    }

    private fun checkCurrentConnectivity(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
```


## WorkManager Push-on-Reconnect

### PushSyncWorker

```kotlin
@HiltWorker
class PushSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncPushEngine: SyncPushEngine,
    private val syncEngine: SyncEngine,
    private val syncMetadataDao: SyncMetadataDao
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Step 1: Push all dirty records
        val pushResult = syncPushEngine.pushAll()

        when (pushResult) {
            is PushResult.NetworkError -> return Result.retry()
            is PushResult.Partial -> {
                // Some failed — retry later
                return Result.retry()
            }
            is PushResult.Success -> { /* continue to pull */ }
        }

        // Step 2: Pull any missed changes
        val hwm = syncMetadataDao.getMetadata()?.highWaterMark ?: 0
        val pullResult = syncEngine.performSync(since = hwm)

        return when (pullResult) {
            is SyncResult.Success -> Result.success()
            is SyncResult.NetworkError -> Result.retry()
            is SyncResult.Error -> {
                if (pullResult.code == 401) Result.failure() else Result.retry()
            }
        }
    }

    companion object {
        const val WORK_NAME = "cwoc_push_sync"

        fun enqueueOnReconnect(context: Context) {
            val request = OneTimeWorkRequestBuilder<PushSyncWorker>()
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
```

### Connectivity → WorkManager → WebSocket Orchestration

```kotlin
// In a singleton orchestrator (e.g., SyncOrchestrator injected in Application)
class SyncOrchestrator @Inject constructor(
    private val connectivityMonitor: ConnectivityMonitor,
    private val webSocketClient: WebSocketClient,
    @ApplicationContext private val context: Context
) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    fun start() {
        scope.launch {
            connectivityMonitor.events.collect { event ->
                when (event) {
                    is ConnectivityEvent.Online -> {
                        // 1. Enqueue push worker (flushes dirty queue)
                        PushSyncWorker.enqueueOnReconnect(context)
                        // 2. WebSocket connects after worker completes
                        // (Worker success triggers WebSocket via WorkManager observer)
                        observeWorkerCompletion()
                    }
                    is ConnectivityEvent.Offline -> {
                        webSocketClient.disconnect()
                    }
                }
            }
        }
    }

    private fun observeWorkerCompletion() {
        // Observe WorkManager state — connect WebSocket when push completes
        WorkManager.getInstance(context)
            .getWorkInfosForUniqueWorkLiveData(PushSyncWorker.WORK_NAME)
            .observeForever { workInfos ->
                val info = workInfos?.firstOrNull()
                if (info?.state == WorkInfo.State.SUCCEEDED) {
                    webSocketClient.connect()
                }
            }
    }
}
```


## Sync State Indicator

### SyncStateManager

Single source of truth for the UI indicator:

```kotlin
class SyncStateManager @Inject constructor(
    private val connectivityMonitor: ConnectivityMonitor,
    private val webSocketClient: WebSocketClient
) {
    private val _isSyncing = MutableStateFlow(false)

    val syncState: StateFlow<SyncState> = combine(
        connectivityMonitor.isOnline,
        webSocketClient.isConnected,
        _isSyncing
    ) { online, wsConnected, syncing ->
        when {
            !online -> SyncState.OFFLINE
            syncing -> SyncState.SYNCING
            wsConnected -> SyncState.ONLINE_IDLE
            else -> SyncState.SYNCING  // Online but WebSocket not yet connected = still syncing
        }
    }.stateIn(
        scope = CoroutineScope(Dispatchers.Main),
        started = SharingStarted.Eagerly,
        initialValue = SyncState.OFFLINE
    )

    fun setSyncing() { _isSyncing.value = true }
    fun setIdle() { _isSyncing.value = false }
}
```

### SyncStateIndicator Composable

```kotlin
@Composable
fun SyncStateIndicator(syncStateManager: SyncStateManager) {
    val state by syncStateManager.syncState.collectAsState()

    val (color, description) = when (state) {
        SyncState.ONLINE_IDLE -> Color(0xFF4CAF50) to "Synced"      // Green
        SyncState.SYNCING -> Color(0xFFFF9800) to "Syncing..."      // Orange
        SyncState.OFFLINE -> Color(0xFFF44336) to "Offline"         // Red
    }

    Box(
        modifier = Modifier
            .size(12.dp)
            .clip(CircleShape)
            .background(color),
        contentDescription = description
    )
}
```

The indicator is placed in the `TopAppBar` of the main scaffold, visible on all list screens.


## UI Patterns

### FAB (Floating Action Button)

Added to Tasks, Notes, and Calendar screens:

```kotlin
@Composable
fun ChitListScaffold(
    title: String,
    navController: NavHostController,
    syncStateManager: SyncStateManager,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                actions = { SyncStateIndicator(syncStateManager) }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    navController.navigate(Screen.Editor.createRoute(Screen.Editor.NEW_CHIT_ID))
                },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Create new chit")
            }
        },
        content = content
    )
}
```

### Swipe-to-Delete

Applied to chit cards in Tasks and Notes list views:

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwipeableChitCard(
    chit: ChitEntity,
    onDelete: (String) -> Unit,
    onClick: (String) -> Unit,
    content: @Composable () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            if (dismissValue == SwipeToDismissBoxValue.EndToStart) {
                onDelete(chit.id)
                true
            } else {
                false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.error)
                    .padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Delete",
                    tint = MaterialTheme.colorScheme.onError
                )
            }
        },
        enableDismissFromStartToEnd = false,
        enableDismissFromEndToStart = true
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onClick(chit.id) }
        ) {
            content()
        }
    }
}
```

### Soft-Delete Flow in ViewModel

```kotlin
// In TasksViewModel (and similarly in NotesViewModel)
fun softDelete(chitId: String) {
    viewModelScope.launch {
        val now = Instant.now().toString()
        chitDao.markDeleted(chitId, now)
        dirtyTracker.markDirty(chitId, setOf("deleted"))

        // Optimistic push if online
        if (connectivityMonitor.isOnline.value) {
            syncPushEngine.pushSingle(chitId)
        }
    }
}
```

### Card Click → Editor Navigation

```kotlin
// In list screens, clicking a card navigates to the editor:
SwipeableChitCard(
    chit = chit,
    onDelete = { viewModel.softDelete(it) },
    onClick = { id -> navController.navigate(Screen.Editor.createRoute(id)) }
) {
    TaskCardContent(chit = chit)
}
```


## Dependency Injection (Phase 2 Additions)

### SyncModule (New)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object SyncModule {

    @Provides
    @Singleton
    fun provideConnectivityMonitor(
        @ApplicationContext context: Context
    ): ConnectivityMonitor {
        return ConnectivityMonitorImpl(context)
    }

    @Provides
    @Singleton
    fun provideDirtyTracker(chitDao: ChitDao): DirtyTracker {
        return DirtyTrackerImpl(chitDao)
    }

    @Provides
    @Singleton
    fun provideSyncStateManager(
        connectivityMonitor: ConnectivityMonitor,
        webSocketClient: WebSocketClient
    ): SyncStateManager {
        return SyncStateManager(connectivityMonitor, webSocketClient)
    }

    @Provides
    @Singleton
    fun provideWebSocketClient(
        okHttpClient: OkHttpClient,
        prefs: SharedPreferences,
        syncEngine: SyncEngine,
        syncMetadataDao: SyncMetadataDao
    ): WebSocketClient {
        return WebSocketClientImpl(okHttpClient, prefs, syncEngine, syncMetadataDao)
    }

    @Provides
    @Singleton
    fun provideSyncPushEngine(
        apiService: CwocApiService,
        chitDao: ChitDao,
        dirtyTracker: DirtyTracker,
        syncMetadataDao: SyncMetadataDao,
        syncStateManager: SyncStateManager
    ): SyncPushEngine {
        return SyncPushEngineImpl(apiService, chitDao, dirtyTracker, syncMetadataDao, syncStateManager)
    }

    @Provides
    @Singleton
    fun provideSyncOrchestrator(
        connectivityMonitor: ConnectivityMonitor,
        webSocketClient: WebSocketClient,
        @ApplicationContext context: Context
    ): SyncOrchestrator {
        return SyncOrchestrator(connectivityMonitor, webSocketClient, context)
    }
}
```


## Project Structure (Phase 2 Additions)

New and modified files relative to Phase 1:

```
android/app/src/main/java/com/cwoc/app/
├── data/
│   ├── local/
│   │   ├── CwocDatabase.kt              # MODIFIED: version 2, add migration
│   │   ├── entity/
│   │   │   └── ChitEntity.kt            # MODIFIED: add isDirty, dirtyFields
│   │   ├── dao/
│   │   │   └── ChitDao.kt               # MODIFIED: add dirty queries, upsert, markDeleted
│   │   └── migration/
│   │       └── Migration1To2.kt         # NEW: Room migration v1→v2
│   ├── remote/
│   │   ├── CwocApiService.kt            # MODIFIED: add pushChanges()
│   │   └── dto/
│   │       ├── SyncPushRequestDto.kt    # NEW: push request DTOs
│   │       └── SyncPushResponseDto.kt   # NEW: push response DTOs
│   ├── repository/
│   │   └── ChitRepository.kt            # MODIFIED: add create, update, softDelete
│   ├── sync/
│   │   ├── SyncEngine.kt                # EXISTING (unchanged)
│   │   ├── SyncPushEngine.kt            # NEW: push engine interface + impl
│   │   ├── SyncWorker.kt                # EXISTING (periodic pull — unchanged)
│   │   ├── PushSyncWorker.kt            # NEW: one-shot push-on-reconnect worker
│   │   ├── DirtyTracker.kt              # NEW: dirty tracking interface + impl
│   │   ├── WebSocketClient.kt           # NEW: OkHttp WebSocket client
│   │   ├── ConnectivityMonitor.kt       # NEW: ConnectivityManager wrapper
│   │   ├── SyncStateManager.kt          # NEW: aggregated sync state
│   │   └── SyncOrchestrator.kt          # NEW: connectivity→worker→websocket flow
│   └── mapper/
│       └── ChitMapper.kt                # NEW: Entity↔FormState, Entity→PushDto
├── di/
│   └── SyncModule.kt                    # NEW: Hilt module for sync components
├── ui/
│   ├── components/
│   │   ├── SyncStateIndicator.kt        # NEW: green/orange/red dot composable
│   │   ├── SwipeableChitCard.kt         # NEW: swipe-to-delete wrapper
│   │   └── ChitListScaffold.kt          # NEW: shared scaffold with FAB + indicator
│   ├── navigation/
│   │   ├── CwocNavGraph.kt              # MODIFIED: add Editor route
│   │   └── Screen.kt                    # MODIFIED: add Editor sealed class
│   └── screens/
│       ├── editor/
│       │   ├── ChitEditorScreen.kt      # NEW: full editor Compose UI
│       │   └── ChitEditorViewModel.kt   # NEW: form state + save/discard
│       ├── tasks/
│       │   ├── TasksScreen.kt           # MODIFIED: add FAB, swipe, click-to-edit
│       │   └── TasksViewModel.kt        # MODIFIED: add softDelete
│       └── notes/
│           ├── NotesScreen.kt           # MODIFIED: add FAB, swipe, click-to-edit
│           └── NotesViewModel.kt        # MODIFIED: add softDelete
```


## Error Handling

### Push Errors

| Scenario | Handling |
|----------|----------|
| Network failure during push | Dirty state preserved; WorkManager retries on reconnect |
| Server returns "error" for a record | Dirty state preserved for that record; other records processed normally |
| Server returns 401 during push | Clear token, navigate to login (same as Phase 1) |
| Server returns 5xx | Treat as transient; WorkManager retries with exponential backoff |
| Push timeout | Same as network failure — dirty state preserved |

### WebSocket Errors

| Scenario | Handling |
|----------|----------|
| Connection refused | Exponential backoff reconnect (2s, 4s, 8s... up to 60s) |
| Connection drops mid-session | Immediate reconnect attempt with backoff |
| Invalid auth on WebSocket | Close connection, do not reconnect (token may be revoked) |
| Malformed message received | Log and ignore; do not crash |

### Editor Errors

| Scenario | Handling |
|----------|----------|
| Chit not found (deleted on another device) | Show error message, navigate back |
| Save fails (Room error) | Show error toast, retain form state |
| UUID collision (astronomically unlikely) | Room REPLACE strategy overwrites — acceptable for single-user |

### Sync State Transitions

```
App launch (online)
    → ConnectivityMonitor emits Online
    → PushSyncWorker enqueued (flush any dirty from previous session)
    → Worker succeeds → WebSocket connects
    → SyncState: SYNCING → ONLINE_IDLE

App launch (offline)
    → ConnectivityMonitor emits nothing (already offline)
    → SyncState: OFFLINE

Network drops while using app
    → ConnectivityMonitor emits Offline
    → WebSocket disconnects gracefully
    → SyncState: ONLINE_IDLE → OFFLINE
    → User continues editing (dirty tracking handles everything)

Network returns
    → ConnectivityMonitor emits Online
    → PushSyncWorker enqueued
    → Worker pushes dirty records
    → Worker pulls missed changes
    → Worker succeeds → WebSocket connects
    → SyncState: OFFLINE → SYNCING → ONLINE_IDLE
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Entity-to-FormState round-trip

*For any* valid ChitEntity, converting it to a ChitFormState via `toFormState()` and then back to a ChitEntity via `toEntity()` SHALL preserve all editable field values (title, note, dates, status, priority, tags, checklist, people, location, color, alerts, recurrence, allDay, timezone, availability).

**Validates: Requirements 1.1, 1.4**


### Property 2: Discard preserves database state

*For any* ChitEntity in the database and any sequence of form field modifications in the editor, calling `discard()` SHALL leave the ChitEntity in the Room database unchanged from its state before the editor was opened.

**Validates: Requirements 1.5**


### Property 3: New chit creation invariants

*For any* non-empty form state saved as a new chit, the resulting ChitEntity in the Room database SHALL have a valid UUID as its `id`, `isDirty = true`, and a non-null `createdDatetime`.

**Validates: Requirements 2.2**


### Property 4: Dirty fields completeness on creation

*For any* new chit saved with N populated fields (non-null, non-default values), the `dirtyFields` JSON array SHALL contain exactly the snake_case field names of those N populated fields.

**Validates: Requirements 2.3**


### Property 5: Dirty fields set semantics — no duplicates

*For any* sequence of edits to the same chit (including editing the same field multiple times), the `dirtyFields` JSON array SHALL contain no duplicate entries. Each field name appears at most once regardless of how many times it was modified.

**Validates: Requirements 3.2**


### Property 6: Local write sets isDirty

*For any* local modification to a ChitEntity (edit or soft-delete), after the write completes, the entity's `isDirty` field SHALL be `true`.

**Validates: Requirements 3.1, 4.2**


### Property 7: Successful push clears dirty state

*For any* ChitEntity with `isDirty = true`, when the server responds with status "accepted" or "created" for that record's push, the entity SHALL have `isDirty = false`, `dirtyFields = "[]"`, and `syncVersion` updated to the server-returned version.

**Validates: Requirements 5.3, 7.3, 7.4**


### Property 8: Merged push updates local entity

*For any* ChitEntity with `isDirty = true`, when the server responds with status "merged" and provides a merged entity, the local ChitEntity SHALL be updated to match the server-merged field values, with `isDirty = false` and `dirtyFields = "[]"`.

**Validates: Requirements 5.4, 7.5**


### Property 9: Failed push preserves dirty state

*For any* ChitEntity with `isDirty = true` and a non-empty `dirtyFields` array, when the push fails (server "error" status or network failure), the entity's `isDirty` SHALL remain `true` and `dirtyFields` SHALL be unchanged.

**Validates: Requirements 5.5, 7.6, 7.7**


### Property 10: Migration preserves existing data

*For any* set of ChitEntity records stored in a version-1 database, after executing MIGRATION_1_2, all original field values SHALL be preserved, `isDirty` SHALL be `false`, and `dirtyFields` SHALL be `"[]"` for every existing record.

**Validates: Requirements 6.1, 6.2, 6.3**


### Property 11: Entity-to-PushDto mapping completeness

*For any* ChitEntity, converting it via `toPushDto()` SHALL produce a ChitPushDto where `last_known_sync_version` equals the entity's `syncVersion`, and all entity fields are mapped to their corresponding snake_case DTO fields with values preserved (accounting for JSON string ↔ object conversion for complex fields).

**Validates: Requirements 7.2, 13.1, 13.2, 13.3**


### Property 12: Push request contains all dirty records

*For any* set of ChitEntity records where `isDirty = true`, when `pushAll()` is called, the resulting `SyncPushRequestDto.chits` list SHALL contain exactly one `ChitPushDto` for each dirty entity, with no omissions and no duplicates.

**Validates: Requirements 8.2**


### Property 13: Soft-deleted chits excluded from active views

*For any* ChitEntity with `deleted = true`, that entity SHALL NOT appear in the results of `getTaskChits()`, `getNoteChits()`, or `getCalendarChits()` DAO queries.

**Validates: Requirements 4.4, 12.4**


## Testing Strategy

Testing is optional per project conventions, but the design supports the following approach if tests are written:

### Property Tests (Kotlin — Kotest Property Testing)

Key candidates for property-based testing:

- **Entity↔FormState round-trip** (Property 1): Generate random ChitEntity instances, verify `toFormState().toEntity()` preserves editable fields
- **Dirty field detection** (Properties 4, 5): Generate random form states and original entities, verify `detectChangedFields()` returns correct field sets with no duplicates
- **Entity→PushDto mapping** (Property 11): Generate random entities, verify all fields map correctly to snake_case DTO
- **Push response handling** (Properties 7, 8, 9): Generate random dirty entities + response statuses, verify correct state transitions

### Unit Tests (Example-Based)

- **Migration**: Verify specific records survive v1→v2 migration with correct defaults
- **Sync state machine**: Verify state transitions for specific connectivity/WebSocket scenarios
- **Editor save flow**: Mock DAO + DirtyTracker, verify correct calls for create vs. edit
- **WebSocket reconnect**: Verify exponential backoff timing for specific failure sequences

### Integration Tests

- **Full push flow**: Mock server, create dirty records, push, verify dirty state cleared
- **Reconnect orchestration**: Simulate offline→online, verify WorkManager→push→pull→WebSocket sequence
- **Swipe-to-delete**: Verify entity marked deleted + dirty after swipe

### What NOT to Test

- Android framework behavior (ConnectivityManager actually fires callbacks, WorkManager actually runs)
- Compose rendering (trust the framework for FAB placement, swipe gestures)
- OkHttp WebSocket transport (trust the library)
- Room migration execution (trust Room's migration runner — test the SQL logic)

