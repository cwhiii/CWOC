# Design: Android Phase 3 — Full Bidirectional Sync + Notifications

## Overview

This design covers Phase 3 of the CWOC Android app: conflict handling UI, contacts CRUD with push sync, settings push sync, attachment management (lazy download/eager upload/cache), local notifications via AlarmManager exact alarms, notification channels, BOOT_COMPLETED receiver, Room migration v2→v3, and edge case handling (delete-vs-edit, checklist reorder, settings conflicts, tag renames).

It builds directly on the Phase 2 architecture (Room v2, DirtyTracker, SyncPushEngine, WebSocketClient, ConnectivityMonitor, WorkManager PushSyncWorker) and extends it with new components. All code is Kotlin targeting API 26+ at `/android/`.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        CWOC Android App — Phase 3                                 │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  UI Layer (Jetpack Compose)                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │  Tasks   │ │  Notes   │ │ Calendar │ │ Chit Editor  │ │ Contacts Editor   │  │
│  │  Screen  │ │  Screen  │ │  Screen  │ │ + Conflict   │ │ (NEW)             │  │
│  │          │ │          │ │          │ │   Banner     │ │                   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────────┘ └────┬──────────────┘  │
│       │             │            │             │                 │                 │
│  ─────┼─────────────┼────────────┼─────────────┼─────────────────┼─────────────── │
│                                                                                   │
│  Data Layer                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────────┐   │
│  │                      Repositories                                           │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐  │   │
│  │  │ ChitRepo    │ │ContactRepo  │ │SettingsRepo  │ │ AttachmentManager  │  │   │
│  │  │ (extended)  │ │ (NEW)       │ │ (NEW)        │ │ (NEW)              │  │   │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘ └──────┬─────────────┘  │   │
│  └─────────┼────────────────┼───────────────┼────────────────┼────────────────┘   │
│            │                │               │                │                    │
│  ┌─────────┴────┐  ┌───────┴───────────────┴────────────────┴──────────────┐    │
│  │ Room DB v3   │  │ Sync Infrastructure (Extended)                          │    │
│  │ + contacts   │  │ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐  │    │
│  │ + settings   │  │ │SyncPushEngine│ │NotificationSch │ │ Attachment   │  │    │
│  │ + conflict   │  │ │ (extended)   │ │ (NEW)          │ │ Cache (NEW)  │  │    │
│  │   _fields    │  │ └──────────────┘ └────────────────┘ └──────────────┘  │    │
│  └──────────────┘  │ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐  │    │
│                     │ │AlarmReceiver │ │BootReceiver    │ │ EdgeCase     │  │    │
│                     │ │ (NEW)        │ │ (NEW)          │ │ Handler(NEW) │  │    │
│                     │ └──────────────┘ └────────────────┘ └──────────────┘  │    │
│                     └────────────────────────────────────────────────────────┘    │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions (Phase 3 Additions)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Conflict UI | Dismissible banner in editor | Non-intrusive; user sees conflict on next open, not during sync |
| Contacts sync | Same dirty-tracking pattern as chits | Consistent architecture; reuses DirtyTracker |
| Settings sync | LWW on entire record | Simple; settings rarely conflict; no field-level merge needed |
| Attachment download | Lazy (on first access) | Saves bandwidth/storage; most attachments never viewed on mobile |
| Attachment upload | Eager (immediate when online) | Ensures other devices get attachments ASAP |
| Attachment cache | LRU eviction with size limit | Prevents unbounded storage growth |
| Notifications | AlarmManager exact alarms | Works offline; no server dependency; precise timing |
| Notification channels | 3 channels (Alarms, Reminders, Timers) | Android best practice; user can customize per-channel |
| Boot recovery | BOOT_COMPLETED receiver | Re-registers alarms lost on reboot |
| Delete-vs-edit conflict | Delete wins | Consistent with server behavior; lost edits logged |
| Checklist conflict | LWW on entire blob | Item-level merge too complex for minimal benefit |
| Tag rename | Propagate to all local chits without dirtying | Server-originated change; no re-push needed |
| DB migration | Additive (new table + new columns) | Non-destructive; preserves all Phase 2 data |


## Components and Interfaces

### New Components (Phase 3)

| Component | Responsibility | Interface |
|-----------|---------------|-----------|
| `ConflictBanner` | Composable showing conflict notification in editor | `ConflictBanner(chitId, onDismiss)` |
| `ContactEntity` | Room entity for contacts table | Data class with sync metadata |
| `ContactDao` | Room DAO for contact queries | `getAll()`, `getById()`, `getDirty()`, `upsert()`, `search()` |
| `ContactRepository` | Contact CRUD + dirty tracking | `create()`, `update()`, `delete()`, `getAll(): Flow` |
| `ContactEditorViewModel` | Manages contact form state | `save()`, `delete()`, `updateField()` |
| `SettingsEntity` | Room entity for settings record | Data class with sync metadata |
| `SettingsDao` | Room DAO for settings | `get()`, `update()`, `updateDirtyState()` |
| `SettingsRepository` | Settings persistence + sync | `get(): Flow`, `update()`, `clearDirty()` |
| `AttachmentManager` | Download/upload/cache orchestration | `download(url)`, `upload(file)`, `getCached(url)` |
| `AttachmentCache` | File storage with LRU eviction | `put(key, file)`, `get(key)`, `evictIfNeeded()` |
| `NotificationScheduler` | Schedule/cancel AlarmManager alarms | `scheduleAlarms(chit)`, `cancelAlarms(chitId)`, `rescheduleAll()` |
| `AlarmReceiver` | BroadcastReceiver for alarm triggers | `onReceive(context, intent)` |
| `BootReceiver` | BOOT_COMPLETED receiver | `onReceive(context, intent)` |
| `NotificationChannelManager` | Creates notification channels at startup | `createChannels()` |
| `EdgeCaseHandler` | Handles delete-vs-edit, tag rename, checklist LWW | `handleServerDeletion()`, `applyTagRename()` |

### Extended Components (from Phase 2)

| Component | Phase 3 Changes |
|-----------|----------------|
| `CwocDatabase` | Bump to version 3, add migration, add ContactDao + SettingsDao |
| `ChitEntity` | Add `conflictFields: String?` column |
| `SyncPushEngine` | Include contacts + settings in push request |
| `SyncEngine` | Handle contacts/settings in pull; apply tag renames; handle delete-vs-edit |
| `DirtyTracker` | Extend to support ContactEntity and SettingsEntity |
| `PushSyncWorker` | Push contacts + settings alongside chits |
| `ChitEditorViewModel` | Add conflict banner state + dismiss logic |
| `CwocApiService` | Add `dismissConflict(chitId)` endpoint |

### Key Interfaces

```kotlin
// Conflict dismiss API (new in Phase 3)
interface CwocApiService {
    // ... existing Phase 1+2 methods ...

    @POST("/api/chit/{id}/dismiss-conflict")
    suspend fun dismissConflict(@Path("id") chitId: String): Response<Unit>
}

// Contact Repository
interface ContactRepository {
    val allContacts: Flow<List<ContactEntity>>
    fun searchContacts(query: String): Flow<List<ContactEntity>>
    suspend fun getById(id: String): ContactEntity?
    suspend fun create(contact: ContactEntity)
    suspend fun update(contact: ContactEntity, changedFields: Set<String>)
    suspend fun delete(contactId: String)
}

// Settings Repository
interface SettingsRepository {
    val settings: Flow<SettingsEntity>
    suspend fun get(): SettingsEntity?
    suspend fun update(settings: SettingsEntity)
    suspend fun replaceWithServerVersion(serverSettings: SettingsEntity)
    suspend fun clearDirty()
}

// Attachment Manager
interface AttachmentManager {
    suspend fun downloadAttachment(url: String, filename: String): Result<File>
    suspend fun uploadAttachment(chitId: String, file: File): Result<String>
    suspend fun getCachedFile(url: String): File?
    suspend fun cacheLocally(file: File, key: String)
    suspend fun uploadPendingAttachments()
    fun getDownloadState(url: String): StateFlow<DownloadState>
}

sealed class DownloadState {
    object NotStarted : DownloadState()
    data class Downloading(val progress: Float) : DownloadState()
    object Completed : DownloadState()
    data class Failed(val message: String) : DownloadState()
}

// Attachment Cache
interface AttachmentCache {
    suspend fun get(key: String): File?
    suspend fun put(key: String, file: File)
    suspend fun evictIfNeeded()
    suspend fun remove(key: String)
    suspend fun getTotalSize(): Long
    suspend fun hasPendingUpload(key: String): Boolean
    val maxSizeBytes: Long
}

// Notification Scheduler
interface NotificationScheduler {
    suspend fun scheduleAlarms(chit: ChitEntity)
    suspend fun cancelAlarms(chitId: String)
    suspend fun rescheduleAll()
    fun hasExactAlarmPermission(): Boolean
}

// Edge Case Handler
interface EdgeCaseHandler {
    suspend fun handleServerDeletion(chitId: String, localEntity: ChitEntity?)
    suspend fun applyTagRename(oldTag: String, newTag: String)
    suspend fun applyChecklistMerge(chitId: String, serverChecklist: String)
}

// Extended Push DTOs (Phase 3)
data class SyncPushRequestDto(
    val chits: List<ChitPushDto>? = null,
    val contacts: List<ContactPushDto>? = null,
    val settings: SettingsPushDto? = null
)

data class SyncPushResponseDto(
    val results: PushResultsDto,
    val server_version: Int
)

data class PushResultsDto(
    val chits: List<ChitPushResultDto>?,
    val contacts: List<ContactPushResultDto>?,
    val settings: SettingsPushResultDto?
)

data class ContactPushResultDto(
    val id: String,
    val status: String,              // "accepted", "created", "merged", "error"
    val sync_version: Int?,
    val conflict_fields: List<String>?,
    val merged: ContactDto?
)

data class SettingsPushResultDto(
    val status: String,              // "accepted", "merged"
    val sync_version: Int?,
    val merged: SettingsDto?
)
```


## Data Models

### ContactEntity (New)

```kotlin
@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey val id: String,
    val name: String?,
    val email: String?,
    val phone: String?,
    val address: String?,
    val notes: String?,
    val tags: List<String>?,          // JSON-serialized via TypeConverter
    val imageUrl: String?,
    // Sync metadata
    val syncVersion: Int = 0,
    val isDirty: Boolean = false,
    val dirtyFields: String? = "[]",  // JSON array of field names
    val deleted: Boolean = false,
    val hasUnviewedConflict: Boolean = false,
    val conflictFields: String? = null,
    val createdDatetime: String? = null,
    val modifiedDatetime: String? = null
)
```

### SettingsEntity (New)

```kotlin
@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val id: String = "default_user",
    val settingsJson: String,         // Full settings blob as JSON string
    // Sync metadata
    val syncVersion: Int = 0,
    val isDirty: Boolean = false,
    val lastModified: String? = null
)
```

### ChitEntity v3 (Extended from v2)

One new column added via Room migration:

```kotlin
@Entity(tableName = "chits")
data class ChitEntity(
    // ... all existing Phase 2 fields unchanged ...
    @PrimaryKey val id: String,
    val title: String?,
    val note: String?,
    // ... (full field list in Phase 1+2 design) ...
    val syncVersion: Int,
    val lastSyncedAt: String?,
    val isDirty: Boolean = false,
    val dirtyFields: String? = "[]",
    val hasUnviewedConflict: Boolean = false,

    // NEW in Phase 3 — conflict field tracking
    val conflictFields: String? = null   // JSON array of field names, e.g. ["title","note"]
)
```

### AttachmentMetadata (New — stored in Room)

```kotlin
@Entity(tableName = "attachment_metadata")
data class AttachmentMetadata(
    @PrimaryKey val id: String,       // UUID
    val chitId: String,
    val url: String?,                  // Server URL (null if not yet uploaded)
    val filename: String,
    val sizeBytes: Long,
    val mimeType: String?,
    val localPath: String?,           // Path in cache (null if not downloaded)
    val pendingUpload: Boolean = false,
    val lastAccessedAt: String? = null,
    val createdAt: String
)
```

### ContactPushDto (New)

```kotlin
data class ContactPushDto(
    val id: String,
    val last_known_sync_version: Int,
    val name: String?,
    val email: String?,
    val phone: String?,
    val address: String?,
    val notes: String?,
    val tags: List<String>?,
    val image_url: String?,
    val deleted: Boolean?,
    val created_datetime: String?,
    val modified_datetime: String?
)
```

### SettingsPushDto (New)

```kotlin
data class SettingsPushDto(
    val last_known_sync_version: Int,
    val settings: Map<String, Any?>   // Full settings object
)
```

### ContactFormState (New — Editor ViewModel)

```kotlin
data class ContactFormState(
    val id: String,
    val name: String = "",
    val email: String = "",
    val phone: String = "",
    val address: String = "",
    val notes: String = "",
    val tags: List<String> = emptyList(),
    val imageUrl: String? = null,
    val isNew: Boolean = false
)
```

### Alert Data Model (for Notification Scheduling)

```kotlin
data class ChitAlert(
    val chitId: String,
    val chitTitle: String,
    val alertType: AlertType,         // ALARM, REMINDER, TIMER
    val triggerTimeMillis: Long,
    val alertId: String               // Unique ID for this specific alert instance
)

enum class AlertType {
    ALARM,      // High importance, sound + vibration
    REMINDER,   // Default importance, no sound
    TIMER       // High importance, sound + vibration
}
```


## Database Migration (v2 → v3)

### Migration Implementation

```kotlin
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // 1. Create contacts table
        database.execSQL("""
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT NOT NULL PRIMARY KEY,
                name TEXT,
                email TEXT,
                phone TEXT,
                address TEXT,
                notes TEXT,
                tags TEXT,
                imageUrl TEXT,
                syncVersion INTEGER NOT NULL DEFAULT 0,
                isDirty INTEGER NOT NULL DEFAULT 0,
                dirtyFields TEXT DEFAULT '[]',
                deleted INTEGER NOT NULL DEFAULT 0,
                hasUnviewedConflict INTEGER NOT NULL DEFAULT 0,
                conflictFields TEXT,
                createdDatetime TEXT,
                modifiedDatetime TEXT
            )
        """)

        // 2. Create settings table
        database.execSQL("""
            CREATE TABLE IF NOT EXISTS settings (
                id TEXT NOT NULL PRIMARY KEY,
                settingsJson TEXT NOT NULL DEFAULT '{}',
                syncVersion INTEGER NOT NULL DEFAULT 0,
                isDirty INTEGER NOT NULL DEFAULT 0,
                lastModified TEXT
            )
        """)

        // 3. Create attachment_metadata table
        database.execSQL("""
            CREATE TABLE IF NOT EXISTS attachment_metadata (
                id TEXT NOT NULL PRIMARY KEY,
                chitId TEXT NOT NULL,
                url TEXT,
                filename TEXT NOT NULL,
                sizeBytes INTEGER NOT NULL DEFAULT 0,
                mimeType TEXT,
                localPath TEXT,
                pendingUpload INTEGER NOT NULL DEFAULT 0,
                lastAccessedAt TEXT,
                createdAt TEXT NOT NULL
            )
        """)

        // 4. Add conflictFields column to chits table
        database.execSQL(
            "ALTER TABLE chits ADD COLUMN conflictFields TEXT DEFAULT NULL"
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
    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
    .build()
}
```

### CwocDatabase v3

```kotlin
@Database(
    entities = [
        ChitEntity::class,
        ContactEntity::class,
        SettingsEntity::class,
        AttachmentMetadata::class,
        SyncMetadataEntity::class
    ],
    version = 3,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class CwocDatabase : RoomDatabase() {
    abstract fun chitDao(): ChitDao
    abstract fun contactDao(): ContactDao
    abstract fun settingsDao(): SettingsDao
    abstract fun attachmentMetadataDao(): AttachmentMetadataDao
    abstract fun syncMetadataDao(): SyncMetadataDao
}
```

The migration is purely additive:
- New `contacts` table with all columns
- New `settings` table with sync metadata
- New `attachment_metadata` table for lazy download tracking
- New `conflictFields` column on existing `chits` table (nullable, defaults to NULL)

All existing Phase 2 data is preserved unchanged.


## Conflict Banner UI

### ConflictBanner Composable

```kotlin
@Composable
fun ConflictBanner(
    chitId: String,
    conflictFields: List<String>,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "⚠️ Sync conflict resolved — View in audit log",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onDismiss) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Dismiss conflict banner",
                    tint = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
    }
}
```

### ChitEditorViewModel — Conflict Extensions

```kotlin
// Added to ChitEditorViewModel (Phase 2 base)
@HiltViewModel
class ChitEditorViewModel @Inject constructor(
    // ... existing Phase 2 dependencies ...
    private val apiService: CwocApiService
) : ViewModel() {

    private val _showConflictBanner = MutableStateFlow(false)
    val showConflictBanner: StateFlow<Boolean> = _showConflictBanner.asStateFlow()

    private val _conflictFields = MutableStateFlow<List<String>>(emptyList())
    val conflictFields: StateFlow<List<String>> = _conflictFields.asStateFlow()

    private fun loadExistingChit() {
        viewModelScope.launch {
            val entity = chitDao.getById(chitId)
            if (entity != null) {
                originalEntity = entity
                _formState.value = entity.toFormState()
                // Phase 3: Check for unviewed conflict
                _showConflictBanner.value = entity.hasUnviewedConflict
                _conflictFields.value = parseConflictFields(entity.conflictFields)
            }
        }
    }

    fun dismissConflict() {
        viewModelScope.launch {
            _showConflictBanner.value = false

            // Update local state immediately
            chitDao.clearConflictFlag(chitId)

            // Attempt server dismiss
            try {
                val response = apiService.dismissConflict(chitId)
                if (!response.isSuccessful) {
                    // Queue for next sync if server call fails
                    queueDismissForSync(chitId)
                }
            } catch (e: Exception) {
                // Network failure — queue for later
                queueDismissForSync(chitId)
            }
        }
    }

    private suspend fun queueDismissForSync(chitId: String) {
        // Store pending dismiss in a lightweight queue (SharedPreferences or Room)
        // PushSyncWorker will process these on next sync
        syncMetadataDao.addPendingDismiss(chitId)
    }

    private fun parseConflictFields(json: String?): List<String> {
        if (json.isNullOrBlank()) return emptyList()
        return Gson().fromJson(json, object : TypeToken<List<String>>() {}.type)
    }
}
```

### ChitDao — Conflict Extensions

```kotlin
@Dao
interface ChitDao {
    // ... existing Phase 2 queries ...

    @Query("UPDATE chits SET hasUnviewedConflict = 0, conflictFields = NULL WHERE id = :id")
    suspend fun clearConflictFlag(id: String)

    @Query("UPDATE chits SET hasUnviewedConflict = 1, conflictFields = :fields WHERE id = :id")
    suspend fun setConflictState(id: String, fields: String)
}
```


## Contacts Editor Screen

### ContactEditorViewModel

```kotlin
@HiltViewModel
class ContactEditorViewModel @Inject constructor(
    private val contactDao: ContactDao,
    private val dirtyTracker: DirtyTracker,
    private val syncPushEngine: SyncPushEngine,
    private val connectivityMonitor: ConnectivityMonitor,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val contactId: String = savedStateHandle["contactId"] ?: "new"
    private val isNew: Boolean = contactId == "new"

    private var originalEntity: ContactEntity? = null

    private val _formState = MutableStateFlow(
        ContactFormState(id = if (isNew) UUID.randomUUID().toString() else contactId, isNew = isNew)
    )
    val formState: StateFlow<ContactFormState> = _formState.asStateFlow()

    init {
        if (!isNew) loadExistingContact()
    }

    private fun loadExistingContact() {
        viewModelScope.launch {
            val entity = contactDao.getById(contactId)
            if (entity != null) {
                originalEntity = entity
                _formState.value = entity.toFormState()
            }
        }
    }

    fun updateField(updater: (ContactFormState) -> ContactFormState) {
        _formState.update(updater)
    }

    fun save(onComplete: () -> Unit) {
        viewModelScope.launch {
            val form = _formState.value
            val now = Instant.now().toString()
            val changedFields = detectContactChangedFields(originalEntity, form)

            if (changedFields.isEmpty() && !isNew) {
                onComplete()
                return@launch
            }

            val entity = form.toEntity(
                originalEntity = originalEntity,
                modifiedDatetime = now,
                createdDatetime = if (isNew) now else originalEntity?.createdDatetime
            )

            contactDao.upsert(entity)
            dirtyTracker.markContactDirty(entity.id, changedFields)

            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch { syncPushEngine.pushAll() }
            }

            onComplete()
        }
    }

    fun delete(onComplete: () -> Unit) {
        viewModelScope.launch {
            val now = Instant.now().toString()
            contactDao.markDeleted(contactId, now)
            dirtyTracker.markContactDirty(contactId, setOf("deleted"))

            if (connectivityMonitor.isOnline.value) {
                viewModelScope.launch { syncPushEngine.pushAll() }
            }

            onComplete()
        }
    }
}
```

### ContactDao

```kotlin
@Dao
interface ContactDao {
    @Query("SELECT * FROM contacts WHERE deleted = 0 ORDER BY name ASC")
    fun getAllActive(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE deleted = 0 AND (name LIKE '%' || :query || '%' OR email LIKE '%' || :query || '%' OR phone LIKE '%' || :query || '%')")
    fun search(query: String): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE id = :id")
    suspend fun getById(id: String): ContactEntity?

    @Query("SELECT * FROM contacts WHERE isDirty = 1")
    suspend fun getDirtyContacts(): List<ContactEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(contact: ContactEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(contacts: List<ContactEntity>)

    @Query("UPDATE contacts SET deleted = 1, modifiedDatetime = :now, isDirty = 1 WHERE id = :id")
    suspend fun markDeleted(id: String, now: String)

    @Query("UPDATE contacts SET isDirty = :isDirty, dirtyFields = :dirtyFields WHERE id = :id")
    suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String)

    @Query("UPDATE contacts SET syncVersion = :version WHERE id = :id")
    suspend fun updateSyncVersion(id: String, version: Int)

    @Query("UPDATE contacts SET hasUnviewedConflict = 1, conflictFields = :fields WHERE id = :id")
    suspend fun setConflictState(id: String, fields: String)
}
```

### Contact Dirty Field Detection

```kotlin
fun detectContactChangedFields(original: ContactEntity?, form: ContactFormState): Set<String> {
    if (original == null) {
        return buildSet {
            if (form.name.isNotBlank()) add("name")
            if (form.email.isNotBlank()) add("email")
            if (form.phone.isNotBlank()) add("phone")
            if (form.address.isNotBlank()) add("address")
            if (form.notes.isNotBlank()) add("notes")
            if (form.tags.isNotEmpty()) add("tags")
            if (form.imageUrl != null) add("image_url")
        }
    }

    return buildSet {
        if (form.name != (original.name ?: "")) add("name")
        if (form.email != (original.email ?: "")) add("email")
        if (form.phone != (original.phone ?: "")) add("phone")
        if (form.address != (original.address ?: "")) add("address")
        if (form.notes != (original.notes ?: "")) add("notes")
        if (form.tags != (original.tags ?: emptyList())) add("tags")
        if (form.imageUrl != original.imageUrl) add("image_url")
    }
}
```


## Extended Sync Push Engine

### SyncPushEngineImpl — Phase 3 Extensions

```kotlin
class SyncPushEngineImpl @Inject constructor(
    private val apiService: CwocApiService,
    private val chitDao: ChitDao,
    private val contactDao: ContactDao,
    private val settingsDao: SettingsDao,
    private val dirtyTracker: DirtyTracker,
    private val syncMetadataDao: SyncMetadataDao,
    private val syncStateManager: SyncStateManager
) : SyncPushEngine {

    override suspend fun pushAll(): PushResult {
        val dirtyChits = chitDao.getDirtyChits()
        val dirtyContacts = contactDao.getDirtyContacts()
        val settings = settingsDao.get()
        val dirtySettings = if (settings?.isDirty == true) settings else null

        if (dirtyChits.isEmpty() && dirtyContacts.isEmpty() && dirtySettings == null) {
            return PushResult.Success(0)
        }

        syncStateManager.setSyncing()

        val request = SyncPushRequestDto(
            chits = dirtyChits.takeIf { it.isNotEmpty() }?.map { it.toPushDto() },
            contacts = dirtyContacts.takeIf { it.isNotEmpty() }?.map { it.toPushDto() },
            settings = dirtySettings?.toPushDto()
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

            // Process chit results (same as Phase 2)
            body.results.chits?.forEach { result ->
                when (result.status) {
                    "accepted", "created" -> {
                        dirtyTracker.clearDirty(result.id)
                        result.sync_version?.let { chitDao.updateSyncVersion(result.id, it) }
                        successes++
                    }
                    "merged" -> {
                        handleChitMerge(result)
                        successes++
                    }
                    "error" -> failures++
                }
            }

            // Process contact results (NEW in Phase 3)
            body.results.contacts?.forEach { result ->
                when (result.status) {
                    "accepted", "created" -> {
                        dirtyTracker.clearContactDirty(result.id)
                        result.sync_version?.let { contactDao.updateSyncVersion(result.id, it) }
                        successes++
                    }
                    "merged" -> {
                        handleContactMerge(result)
                        successes++
                    }
                    "error" -> failures++
                }
            }

            // Process settings result (NEW in Phase 3)
            body.results.settings?.let { result ->
                when (result.status) {
                    "accepted" -> {
                        settingsDao.clearDirty()
                        result.sync_version?.let { settingsDao.updateSyncVersion(it) }
                        successes++
                    }
                    "merged" -> {
                        handleSettingsMerge(result)
                        successes++
                    }
                }
            }

            syncMetadataDao.updateHighWaterMark(body.server_version, Instant.now().toString())
            syncStateManager.setIdle()

            return if (failures == 0) PushResult.Success(body.server_version)
            else PushResult.Partial(successes, failures)

        } catch (e: Exception) {
            syncStateManager.setIdle()
            return PushResult.NetworkError(e.message ?: "Unknown error")
        }
    }

    private suspend fun handleChitMerge(result: ChitPushResultDto) {
        // Update local entity with server's merged values
        result.merged?.let { mergedDto ->
            val mergedEntity = mergedDto.toEntity(Instant.now().toString())
            val entityWithConflict = mergedEntity.copy(
                hasUnviewedConflict = true,
                conflictFields = Gson().toJson(result.conflict_fields ?: emptyList<String>()),
                isDirty = false,
                dirtyFields = "[]"
            )
            chitDao.upsert(entityWithConflict)
        } ?: run {
            // Fallback: set conflict flag, clear dirty
            chitDao.setConflictState(result.id, Gson().toJson(result.conflict_fields ?: emptyList<String>()))
            dirtyTracker.clearDirty(result.id)
            result.sync_version?.let { chitDao.updateSyncVersion(result.id, it) }
        }
    }

    private suspend fun handleContactMerge(result: ContactPushResultDto) {
        result.merged?.let { mergedDto ->
            val mergedEntity = mergedDto.toEntity().copy(
                hasUnviewedConflict = true,
                conflictFields = Gson().toJson(result.conflict_fields ?: emptyList<String>()),
                isDirty = false,
                dirtyFields = "[]"
            )
            contactDao.upsert(mergedEntity)
        } ?: run {
            contactDao.setConflictState(result.id, Gson().toJson(result.conflict_fields ?: emptyList<String>()))
            dirtyTracker.clearContactDirty(result.id)
            result.sync_version?.let { contactDao.updateSyncVersion(result.id, it) }
        }
    }

    private suspend fun handleSettingsMerge(result: SettingsPushResultDto) {
        // LWW on entire record — replace local with server version
        result.merged?.let { mergedDto ->
            val mergedEntity = mergedDto.toEntity().copy(isDirty = false)
            settingsDao.replace(mergedEntity)
        } ?: run {
            settingsDao.clearDirty()
            result.sync_version?.let { settingsDao.updateSyncVersion(it) }
        }
    }
}
```

### DirtyTracker — Phase 3 Extensions

```kotlin
// Extended interface
interface DirtyTracker {
    // Existing Phase 2
    suspend fun markDirty(chitId: String, changedFields: Set<String>)
    suspend fun clearDirty(chitId: String)
    suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity)

    // NEW Phase 3 — Contacts
    suspend fun markContactDirty(contactId: String, changedFields: Set<String>)
    suspend fun clearContactDirty(contactId: String)

    // NEW Phase 3 — Settings
    suspend fun markSettingsDirty()
    suspend fun clearSettingsDirty()
}
```


## Attachment Manager

### AttachmentManagerImpl

```kotlin
class AttachmentManagerImpl @Inject constructor(
    private val apiService: CwocApiService,
    private val attachmentCache: AttachmentCache,
    private val attachmentMetadataDao: AttachmentMetadataDao,
    private val connectivityMonitor: ConnectivityMonitor,
    @ApplicationContext private val context: Context
) : AttachmentManager {

    private val downloadStates = ConcurrentHashMap<String, MutableStateFlow<DownloadState>>()

    override suspend fun downloadAttachment(url: String, filename: String): Result<File> {
        // Check cache first
        val cached = attachmentCache.get(url)
        if (cached != null && cached.exists()) {
            updateLastAccessed(url)
            return Result.success(cached)
        }

        // Download from server
        val stateFlow = getOrCreateDownloadState(url)
        stateFlow.value = DownloadState.Downloading(0f)

        return try {
            val responseBody = apiService.downloadFile(url)
            val file = File(context.cacheDir, "attachments/$filename")
            file.parentFile?.mkdirs()

            responseBody.byteStream().use { input ->
                val totalBytes = responseBody.contentLength()
                var bytesRead = 0L
                file.outputStream().use { output ->
                    val buffer = ByteArray(8192)
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        output.write(buffer, 0, read)
                        bytesRead += read
                        if (totalBytes > 0) {
                            stateFlow.value = DownloadState.Downloading(bytesRead.toFloat() / totalBytes)
                        }
                    }
                }
            }

            // Store in cache
            attachmentCache.put(url, file)
            updateLastAccessed(url)
            attachmentMetadataDao.updateLocalPath(url, file.absolutePath)

            stateFlow.value = DownloadState.Completed
            Result.success(file)

        } catch (e: Exception) {
            stateFlow.value = DownloadState.Failed(e.message ?: "Download failed")
            Result.failure(e)
        }
    }

    override suspend fun uploadAttachment(chitId: String, file: File): Result<String> {
        val metadata = AttachmentMetadata(
            id = UUID.randomUUID().toString(),
            chitId = chitId,
            url = null,
            filename = file.name,
            sizeBytes = file.length(),
            mimeType = getMimeType(file),
            localPath = file.absolutePath,
            pendingUpload = true,
            lastAccessedAt = Instant.now().toString(),
            createdAt = Instant.now().toString()
        )

        // Store metadata + cache file immediately
        attachmentMetadataDao.insert(metadata)
        attachmentCache.put(metadata.id, file)

        if (!connectivityMonitor.isOnline.value) {
            // Queue for later — metadata.pendingUpload = true handles this
            return Result.success(metadata.id)
        }

        return performUpload(metadata)
    }

    override suspend fun getCachedFile(url: String): File? {
        val file = attachmentCache.get(url)
        if (file != null) updateLastAccessed(url)
        return file
    }

    override suspend fun cacheLocally(file: File, key: String) {
        attachmentCache.put(key, file)
    }

    override suspend fun uploadPendingAttachments() {
        val pending = attachmentMetadataDao.getPendingUploads()
        pending.forEach { metadata ->
            val file = metadata.localPath?.let { File(it) }
            if (file != null && file.exists()) {
                performUpload(metadata)
            }
        }
    }

    override fun getDownloadState(url: String): StateFlow<DownloadState> {
        return getOrCreateDownloadState(url)
    }

    private suspend fun performUpload(metadata: AttachmentMetadata): Result<String> {
        return try {
            val file = File(metadata.localPath ?: return Result.failure(Exception("No local file")))
            val requestBody = file.asRequestBody(metadata.mimeType?.toMediaTypeOrNull())
            val part = MultipartBody.Part.createFormData("file", file.name, requestBody)

            val response = apiService.uploadAttachment(metadata.chitId, part)
            if (response.isSuccessful) {
                val serverUrl = response.body()?.url ?: return Result.failure(Exception("No URL in response"))
                attachmentMetadataDao.updateAfterUpload(metadata.id, serverUrl)
                Result.success(serverUrl)
            } else {
                Result.failure(Exception("Upload failed: HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            // Retain pendingUpload = true for retry
            Result.failure(e)
        }
    }

    private fun getOrCreateDownloadState(url: String): MutableStateFlow<DownloadState> {
        return downloadStates.getOrPut(url) { MutableStateFlow(DownloadState.NotStarted) }
    }

    private suspend fun updateLastAccessed(url: String) {
        attachmentMetadataDao.updateLastAccessed(url, Instant.now().toString())
    }

    private fun getMimeType(file: File): String? {
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension)
    }
}
```

### AttachmentCacheImpl

```kotlin
class AttachmentCacheImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val attachmentMetadataDao: AttachmentMetadataDao
) : AttachmentCache {

    override val maxSizeBytes: Long = 100 * 1024 * 1024  // 100 MB default

    private val cacheDir: File
        get() = File(context.cacheDir, "attachments").also { it.mkdirs() }

    override suspend fun get(key: String): File? {
        val metadata = attachmentMetadataDao.getByUrl(key)
        val path = metadata?.localPath ?: return null
        val file = File(path)
        return if (file.exists()) file else null
    }

    override suspend fun put(key: String, file: File) {
        val destFile = File(cacheDir, file.name)
        if (file.absolutePath != destFile.absolutePath) {
            file.copyTo(destFile, overwrite = true)
        }
        evictIfNeeded()
    }

    override suspend fun evictIfNeeded() {
        val totalSize = getTotalSize()
        if (totalSize <= maxSizeBytes) return

        // Get all cached files sorted by last accessed (oldest first)
        val allMetadata = attachmentMetadataDao.getAllCachedSortedByAccess()
        var currentSize = totalSize

        for (metadata in allMetadata) {
            if (currentSize <= maxSizeBytes) break

            // Never evict pending uploads
            if (metadata.pendingUpload) continue

            // Remove file, retain metadata
            metadata.localPath?.let { path ->
                val file = File(path)
                if (file.exists()) {
                    currentSize -= file.length()
                    file.delete()
                }
            }
            attachmentMetadataDao.clearLocalPath(metadata.id)
        }
    }

    override suspend fun remove(key: String) {
        val metadata = attachmentMetadataDao.getByUrl(key)
        metadata?.localPath?.let { File(it).delete() }
        attachmentMetadataDao.clearLocalPath(metadata?.id ?: return)
    }

    override suspend fun getTotalSize(): Long {
        return cacheDir.walkTopDown()
            .filter { it.isFile }
            .sumOf { it.length() }
    }

    override suspend fun hasPendingUpload(key: String): Boolean {
        return attachmentMetadataDao.getByUrl(key)?.pendingUpload == true
    }
}
```

### AttachmentMetadataDao

```kotlin
@Dao
interface AttachmentMetadataDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(metadata: AttachmentMetadata)

    @Query("SELECT * FROM attachment_metadata WHERE url = :url LIMIT 1")
    suspend fun getByUrl(url: String): AttachmentMetadata?

    @Query("SELECT * FROM attachment_metadata WHERE chitId = :chitId")
    suspend fun getByChitId(chitId: String): List<AttachmentMetadata>

    @Query("SELECT * FROM attachment_metadata WHERE pendingUpload = 1")
    suspend fun getPendingUploads(): List<AttachmentMetadata>

    @Query("SELECT * FROM attachment_metadata WHERE localPath IS NOT NULL ORDER BY lastAccessedAt ASC")
    suspend fun getAllCachedSortedByAccess(): List<AttachmentMetadata>

    @Query("UPDATE attachment_metadata SET localPath = :path WHERE url = :url")
    suspend fun updateLocalPath(url: String, path: String)

    @Query("UPDATE attachment_metadata SET lastAccessedAt = :timestamp WHERE url = :url")
    suspend fun updateLastAccessed(url: String, timestamp: String)

    @Query("UPDATE attachment_metadata SET url = :serverUrl, pendingUpload = 0 WHERE id = :id")
    suspend fun updateAfterUpload(id: String, serverUrl: String)

    @Query("UPDATE attachment_metadata SET localPath = NULL WHERE id = :id")
    suspend fun clearLocalPath(id: String)
}
```


## Notification Scheduler

### NotificationSchedulerImpl

```kotlin
class NotificationSchedulerImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val chitDao: ChitDao
) : NotificationScheduler {

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    override suspend fun scheduleAlarms(chit: ChitEntity) {
        // Cancel existing alarms for this chit first
        cancelAlarms(chit.id)

        // Parse alerts from chit
        val alerts = parseAlerts(chit)
        if (alerts.isEmpty()) return

        alerts.forEach { alert ->
            if (alert.triggerTimeMillis > System.currentTimeMillis()) {
                scheduleExactAlarm(alert)
            }
        }
    }

    override suspend fun cancelAlarms(chitId: String) {
        // Cancel all alarms with request codes derived from chitId
        // We use a deterministic hash of chitId + alertIndex as the request code
        val chit = chitDao.getById(chitId) ?: return
        val alerts = parseAlerts(chit)
        alerts.forEachIndexed { index, _ ->
            val requestCode = getRequestCode(chitId, index)
            val intent = createAlarmIntent(chitId, index)
            val pendingIntent = PendingIntent.getBroadcast(
                context, requestCode, intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            pendingIntent?.let { alarmManager.cancel(it) }
        }
    }

    override suspend fun rescheduleAll() {
        // Called on boot — re-register all active alarms
        val chitsWithAlerts = chitDao.getChitsWithAlerts()
        chitsWithAlerts.forEach { chit ->
            scheduleAlarms(chit)
        }
    }

    override fun hasExactAlarmPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true  // Pre-API 31 doesn't need permission
        }
    }

    private fun scheduleExactAlarm(alert: ChitAlert) {
        val requestCode = getRequestCode(alert.chitId, alert.alertId.hashCode())
        val intent = createAlarmIntent(alert.chitId, alert.alertId.hashCode()).apply {
            putExtra(AlarmReceiver.EXTRA_CHIT_ID, alert.chitId)
            putExtra(AlarmReceiver.EXTRA_CHIT_TITLE, alert.chitTitle)
            putExtra(AlarmReceiver.EXTRA_ALERT_TYPE, alert.alertType.name)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (hasExactAlarmPermission()) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                alert.triggerTimeMillis,
                pendingIntent
            )
        } else {
            // Fallback to inexact alarm when permission not granted (API 31+)
            alarmManager.set(
                AlarmManager.RTC_WAKEUP,
                alert.triggerTimeMillis,
                pendingIntent
            )
        }
    }

    private fun createAlarmIntent(chitId: String, index: Int): Intent {
        return Intent(context, AlarmReceiver::class.java).apply {
            action = "com.cwoc.app.ALARM_TRIGGER"
            putExtra(AlarmReceiver.EXTRA_REQUEST_CODE, getRequestCode(chitId, index))
        }
    }

    private fun getRequestCode(chitId: String, index: Int): Int {
        // Deterministic request code from chitId + index
        return (chitId.hashCode() * 31 + index) and Int.MAX_VALUE
    }

    private fun parseAlerts(chit: ChitEntity): List<ChitAlert> {
        val alertsJson = chit.alerts ?: return emptyList()
        return try {
            val gson = Gson()
            val alertList: List<Map<String, Any>> = gson.fromJson(
                alertsJson, object : TypeToken<List<Map<String, Any>>>() {}.type
            )
            alertList.mapNotNull { alertMap ->
                val triggerTime = (alertMap["trigger_time"] as? String)?.let {
                    Instant.parse(it).toEpochMilli()
                } ?: return@mapNotNull null

                val type = when (alertMap["type"] as? String) {
                    "alarm" -> AlertType.ALARM
                    "reminder" -> AlertType.REMINDER
                    "timer" -> AlertType.TIMER
                    else -> AlertType.REMINDER
                }

                ChitAlert(
                    chitId = chit.id,
                    chitTitle = chit.title ?: "CWOC Alert",
                    alertType = type,
                    triggerTimeMillis = triggerTime,
                    alertId = "${chit.id}_${alertMap["id"] ?: triggerTime}"
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
```

### AlarmReceiver

```kotlin
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val EXTRA_CHIT_ID = "chit_id"
        const val EXTRA_CHIT_TITLE = "chit_title"
        const val EXTRA_ALERT_TYPE = "alert_type"
        const val EXTRA_REQUEST_CODE = "request_code"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val chitId = intent.getStringExtra(EXTRA_CHIT_ID) ?: return
        val chitTitle = intent.getStringExtra(EXTRA_CHIT_TITLE) ?: "CWOC Alert"
        val alertType = intent.getStringExtra(EXTRA_ALERT_TYPE)?.let {
            AlertType.valueOf(it)
        } ?: AlertType.REMINDER

        val channelId = when (alertType) {
            AlertType.ALARM -> NotificationChannelManager.CHANNEL_ALARMS
            AlertType.REMINDER -> NotificationChannelManager.CHANNEL_REMINDERS
            AlertType.TIMER -> NotificationChannelManager.CHANNEL_TIMERS
        }

        // Build tap intent → opens Chit Editor
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to_chit", chitId)
        }
        val pendingTapIntent = PendingIntent.getActivity(
            context, chitId.hashCode(), tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(chitTitle)
            .setContentText(getContentText(alertType))
            .setPriority(getPriority(alertType))
            .setContentIntent(pendingTapIntent)
            .setAutoCancel(true)
            .apply {
                if (alertType == AlertType.ALARM || alertType == AlertType.TIMER) {
                    setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
                }
            }
            .build()

        val notificationManager = NotificationManagerCompat.from(context)
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            notificationManager.notify(chitId.hashCode(), notification)
        }
    }

    private fun getContentText(type: AlertType): String = when (type) {
        AlertType.ALARM -> "Alarm"
        AlertType.REMINDER -> "Reminder"
        AlertType.TIMER -> "Timer complete"
    }

    private fun getPriority(type: AlertType): Int = when (type) {
        AlertType.ALARM, AlertType.TIMER -> NotificationCompat.PRIORITY_HIGH
        AlertType.REMINDER -> NotificationCompat.PRIORITY_DEFAULT
    }
}
```

### BootReceiver

```kotlin
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        // Use goAsync() for coroutine work in BroadcastReceiver
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Get NotificationScheduler from Hilt entry point
                val entryPoint = EntryPointAccessors.fromApplication(
                    context.applicationContext,
                    BootReceiverEntryPoint::class.java
                )
                val scheduler = entryPoint.notificationScheduler()
                scheduler.rescheduleAll()
            } finally {
                pendingResult.finish()
            }
        }
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface BootReceiverEntryPoint {
    fun notificationScheduler(): NotificationScheduler
}
```

### NotificationChannelManager

```kotlin
class NotificationChannelManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        const val CHANNEL_ALARMS = "cwoc_alarms"
        const val CHANNEL_REMINDERS = "cwoc_reminders"
        const val CHANNEL_TIMERS = "cwoc_timers"
    }

    fun createChannels() {
        val notificationManager = context.getSystemService(NotificationManager::class.java)

        val alarmsChannel = NotificationChannel(
            CHANNEL_ALARMS,
            "Alarms",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Chit alarm notifications"
            enableVibration(true)
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
            )
        }

        val remindersChannel = NotificationChannel(
            CHANNEL_REMINDERS,
            "Reminders",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Chit reminder notifications"
            setSound(null, null)
            enableVibration(false)
        }

        val timersChannel = NotificationChannel(
            CHANNEL_TIMERS,
            "Timers",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Chit timer notifications"
            enableVibration(true)
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
            )
        }

        notificationManager.createNotificationChannels(
            listOf(alarmsChannel, remindersChannel, timersChannel)
        )
    }
}
```


## Edge Case Handling

### EdgeCaseHandlerImpl

```kotlin
class EdgeCaseHandlerImpl @Inject constructor(
    private val chitDao: ChitDao,
    private val dirtyTracker: DirtyTracker,
    private val notificationScheduler: NotificationScheduler,
    private val lostEditLogger: LostEditLogger
) : EdgeCaseHandler {

    /**
     * Delete-vs-Edit conflict: Server deletion wins.
     * If the chit has local dirty edits, those are lost — log for user awareness.
     */
    override suspend fun handleServerDeletion(chitId: String, localEntity: ChitEntity?) {
        if (localEntity == null) return

        // Log lost edit if the chit had local dirty changes
        if (localEntity.isDirty) {
            lostEditLogger.logLostEdit(
                chitId = chitId,
                chitTitle = localEntity.title,
                dirtyFields = localEntity.dirtyFields,
                timestamp = Instant.now().toString()
            )
        }

        // Apply deletion — overrides any local state
        chitDao.upsert(localEntity.copy(
            deleted = true,
            isDirty = false,
            dirtyFields = "[]",
            hasUnviewedConflict = false,
            conflictFields = null
        ))

        // Cancel any scheduled alarms for this chit
        notificationScheduler.cancelAlarms(chitId)
    }

    /**
     * Tag rename: Update all local chits with the old tag, without dirtying them.
     */
    override suspend fun applyTagRename(oldTag: String, newTag: String) {
        val affectedChits = chitDao.getChitsWithTag(oldTag)
        affectedChits.forEach { chit ->
            val updatedTags = chit.tags?.map { if (it == oldTag) newTag else it }
            // Update tags WITHOUT marking dirty (server-originated change)
            chitDao.updateTagsOnly(chit.id, updatedTags)
        }
    }

    /**
     * Checklist conflict: LWW on entire checklist blob.
     * Replace local checklist entirely with server's merged version.
     */
    override suspend fun applyChecklistMerge(chitId: String, serverChecklist: String) {
        chitDao.updateChecklistOnly(chitId, serverChecklist)
    }
}
```

### LostEditLogger

```kotlin
/**
 * Logs lost edits for user awareness. These entries will be visible
 * in a future audit log view within the app.
 */
class LostEditLogger @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences("lost_edits", Context.MODE_PRIVATE)

    fun logLostEdit(chitId: String, chitTitle: String?, dirtyFields: String?, timestamp: String) {
        val entry = LostEditEntry(chitId, chitTitle, dirtyFields, timestamp)
        val existing = getLostEdits().toMutableList()
        existing.add(entry)
        // Keep last 50 entries
        val trimmed = existing.takeLast(50)
        prefs.edit().putString("entries", Gson().toJson(trimmed)).apply()
    }

    fun getLostEdits(): List<LostEditEntry> {
        val json = prefs.getString("entries", null) ?: return emptyList()
        return Gson().fromJson(json, object : TypeToken<List<LostEditEntry>>() {}.type)
    }
}

data class LostEditEntry(
    val chitId: String,
    val chitTitle: String?,
    val dirtyFields: String?,
    val timestamp: String
)
```

### ChitDao — Edge Case Extensions

```kotlin
@Dao
interface ChitDao {
    // ... existing queries ...

    @Query("SELECT * FROM chits WHERE alerts IS NOT NULL AND deleted = 0")
    suspend fun getChitsWithAlerts(): List<ChitEntity>

    @Query("SELECT * FROM chits WHERE tags LIKE '%' || :tag || '%' AND deleted = 0")
    suspend fun getChitsWithTag(tag: String): List<ChitEntity>

    @Query("UPDATE chits SET tags = :tags WHERE id = :id")
    suspend fun updateTagsOnly(id: String, tags: List<String>?)

    @Query("UPDATE chits SET checklist = :checklist WHERE id = :id")
    suspend fun updateChecklistOnly(id: String, checklist: String)
}
```

### SyncEngine — Pull Extensions (Phase 3)

```kotlin
// In SyncEngine.performSync() — extended pull handling
suspend fun processPullResponse(response: SyncPullResponseDto) {
    // Process chits (existing Phase 2 logic + Phase 3 edge cases)
    response.chits?.forEach { chitDto ->
        val localEntity = chitDao.getById(chitDto.id)

        if (chitDto.deleted == true) {
            // Delete-vs-edit: server deletion wins
            edgeCaseHandler.handleServerDeletion(chitDto.id, localEntity)
        } else {
            // Normal upsert
            val entity = chitDto.toEntity(Instant.now().toString())
            chitDao.upsert(entity)
            // Schedule/reschedule alarms if alert data present
            notificationScheduler.scheduleAlarms(entity)
        }
    }

    // Process contacts (NEW in Phase 3)
    response.contacts?.forEach { contactDto ->
        val entity = contactDto.toEntity()
        contactDao.upsert(entity)
    }

    // Process settings (NEW in Phase 3)
    response.settings?.let { settingsDto ->
        val entity = settingsDto.toEntity()
        settingsDao.replace(entity)
    }

    // Process tag renames (NEW in Phase 3)
    response.tag_renames?.forEach { rename ->
        edgeCaseHandler.applyTagRename(rename.old_name, rename.new_name)
    }

    // Update high-water mark
    syncMetadataDao.updateHighWaterMark(response.server_version, Instant.now().toString())
}
```


## AndroidManifest Additions

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Exact alarm permissions -->
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />

    <!-- Boot completed for alarm re-registration -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <!-- Notifications (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application ...>

        <!-- Alarm BroadcastReceiver -->
        <receiver
            android:name=".sync.AlarmReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="com.cwoc.app.ALARM_TRIGGER" />
            </intent-filter>
        </receiver>

        <!-- Boot BroadcastReceiver -->
        <receiver
            android:name=".sync.BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>
```

## Dependency Injection (Phase 3 Additions)

### Phase3Module (New)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object Phase3Module {

    @Provides
    @Singleton
    fun provideContactRepository(
        contactDao: ContactDao,
        dirtyTracker: DirtyTracker,
        syncPushEngine: SyncPushEngine,
        connectivityMonitor: ConnectivityMonitor
    ): ContactRepository {
        return ContactRepositoryImpl(contactDao, dirtyTracker, syncPushEngine, connectivityMonitor)
    }

    @Provides
    @Singleton
    fun provideSettingsRepository(
        settingsDao: SettingsDao,
        dirtyTracker: DirtyTracker
    ): SettingsRepository {
        return SettingsRepositoryImpl(settingsDao, dirtyTracker)
    }

    @Provides
    @Singleton
    fun provideAttachmentManager(
        apiService: CwocApiService,
        attachmentCache: AttachmentCache,
        attachmentMetadataDao: AttachmentMetadataDao,
        connectivityMonitor: ConnectivityMonitor,
        @ApplicationContext context: Context
    ): AttachmentManager {
        return AttachmentManagerImpl(apiService, attachmentCache, attachmentMetadataDao, connectivityMonitor, context)
    }

    @Provides
    @Singleton
    fun provideAttachmentCache(
        @ApplicationContext context: Context,
        attachmentMetadataDao: AttachmentMetadataDao
    ): AttachmentCache {
        return AttachmentCacheImpl(context, attachmentMetadataDao)
    }

    @Provides
    @Singleton
    fun provideNotificationScheduler(
        @ApplicationContext context: Context,
        chitDao: ChitDao
    ): NotificationScheduler {
        return NotificationSchedulerImpl(context, chitDao)
    }

    @Provides
    @Singleton
    fun provideNotificationChannelManager(
        @ApplicationContext context: Context
    ): NotificationChannelManager {
        return NotificationChannelManager(context)
    }

    @Provides
    @Singleton
    fun provideEdgeCaseHandler(
        chitDao: ChitDao,
        dirtyTracker: DirtyTracker,
        notificationScheduler: NotificationScheduler,
        lostEditLogger: LostEditLogger
    ): EdgeCaseHandler {
        return EdgeCaseHandlerImpl(chitDao, dirtyTracker, notificationScheduler, lostEditLogger)
    }

    @Provides
    @Singleton
    fun provideLostEditLogger(
        @ApplicationContext context: Context
    ): LostEditLogger {
        return LostEditLogger(context)
    }
}
```

## Project Structure (Phase 3 Additions)

New and modified files relative to Phase 2:

```
android/app/src/main/java/com/cwoc/app/
├── data/
│   ├── local/
│   │   ├── CwocDatabase.kt                  # MODIFIED: version 3, add migration, new DAOs
│   │   ├── entity/
│   │   │   ├── ChitEntity.kt                # MODIFIED: add conflictFields column
│   │   │   ├── ContactEntity.kt             # NEW: contacts table entity
│   │   │   ├── SettingsEntity.kt            # NEW: settings table entity
│   │   │   └── AttachmentMetadata.kt        # NEW: attachment metadata entity
│   │   ├── dao/
│   │   │   ├── ChitDao.kt                   # MODIFIED: add conflict + edge case queries
│   │   │   ├── ContactDao.kt                # NEW: contact CRUD queries
│   │   │   ├── SettingsDao.kt               # NEW: settings queries
│   │   │   └── AttachmentMetadataDao.kt     # NEW: attachment metadata queries
│   │   └── migration/
│   │       ├── Migration1To2.kt             # EXISTING (unchanged)
│   │       └── Migration2To3.kt             # NEW: Room migration v2→v3
│   ├── remote/
│   │   ├── CwocApiService.kt                # MODIFIED: add dismissConflict, upload/download
│   │   └── dto/
│   │       ├── SyncPushRequestDto.kt        # MODIFIED: add contacts + settings
│   │       ├── SyncPushResponseDto.kt       # MODIFIED: add contact + settings results
│   │       ├── ContactPushDto.kt            # NEW: contact push DTO
│   │       └── SettingsPushDto.kt           # NEW: settings push DTO
│   ├── repository/
│   │   ├── ChitRepository.kt                # EXISTING (unchanged)
│   │   ├── ContactRepository.kt             # NEW: contact CRUD + sync
│   │   └── SettingsRepository.kt            # NEW: settings persistence + sync
│   ├── sync/
│   │   ├── SyncEngine.kt                    # MODIFIED: handle contacts/settings/tag renames in pull
│   │   ├── SyncPushEngine.kt                # MODIFIED: include contacts + settings in push
│   │   ├── DirtyTracker.kt                  # MODIFIED: add contact + settings dirty methods
│   │   ├── PushSyncWorker.kt                # MODIFIED: push contacts + settings
│   │   ├── EdgeCaseHandler.kt               # NEW: delete-vs-edit, tag rename, checklist LWW
│   │   ├── LostEditLogger.kt                # NEW: logs lost edits from delete-vs-edit
│   │   ├── NotificationScheduler.kt         # NEW: AlarmManager scheduling
│   │   ├── AlarmReceiver.kt                 # NEW: BroadcastReceiver for alarm triggers
│   │   ├── BootReceiver.kt                  # NEW: BOOT_COMPLETED re-registration
│   │   ├── NotificationChannelManager.kt    # NEW: creates notification channels
│   │   ├── AttachmentManager.kt             # NEW: download/upload/cache orchestration
│   │   └── AttachmentCache.kt               # NEW: LRU file cache
│   └── mapper/
│       ├── ChitMapper.kt                    # EXISTING (unchanged)
│       ├── ContactMapper.kt                 # NEW: Contact entity↔DTO↔FormState
│       └── SettingsMapper.kt                # NEW: Settings entity↔DTO
├── di/
│   ├── SyncModule.kt                        # EXISTING (unchanged)
│   └── Phase3Module.kt                      # NEW: Hilt module for Phase 3 components
├── ui/
│   ├── components/
│   │   ├── ConflictBanner.kt                # NEW: conflict notification composable
│   │   └── AttachmentView.kt                # NEW: attachment display with download state
│   ├── screens/
│   │   ├── editor/
│   │   │   ├── ChitEditorScreen.kt          # MODIFIED: add ConflictBanner
│   │   │   └── ChitEditorViewModel.kt       # MODIFIED: add conflict dismiss logic
│   │   └── contacts/
│   │       ├── ContactListScreen.kt         # NEW: contacts list with search
│   │       ├── ContactEditorScreen.kt       # NEW: contact editor form
│   │       └── ContactEditorViewModel.kt    # NEW: contact form state + save
│   └── navigation/
│       ├── CwocNavGraph.kt                  # MODIFIED: add contact routes
│       └── Screen.kt                        # MODIFIED: add ContactList, ContactEditor
```


## Error Handling

### Conflict Dismiss Errors

| Scenario | Handling |
|----------|----------|
| Network failure on dismiss | Hide banner locally, queue dismiss for next sync cycle |
| Server returns 404 (chit deleted) | Clear conflict flag locally, ignore |
| Server returns 401 | Clear token, navigate to login |

### Attachment Errors

| Scenario | Handling |
|----------|----------|
| Download fails (network) | Show placeholder with "Download when online" + retry button |
| Download fails (404) | Show "Attachment unavailable" placeholder |
| Upload fails (network) | Retain pendingUpload=true, retry on reconnect |
| Upload fails (server error) | Retain pendingUpload=true, retry with backoff |
| Cache eviction during upload | Never evict files with pendingUpload=true |
| File corrupted in cache | Delete local file, clear localPath, re-download on next access |

### Notification Errors

| Scenario | Handling |
|----------|----------|
| Exact alarm permission denied (API 31+) | Fall back to inexact alarms, show warning in settings |
| POST_NOTIFICATIONS permission denied (API 33+) | Alarms still fire but notification not shown; prompt user |
| Boot receiver fails | Alarms lost until next sync pull (which re-triggers scheduling) |
| Invalid alert JSON in chit | Skip that alert, log warning, continue with valid alerts |

### Edge Case Errors

| Scenario | Handling |
|----------|----------|
| Tag rename affects 0 chits | No-op (tag may have been removed from all chits already) |
| Delete-vs-edit on chit with pending attachment upload | Delete wins; pending upload cancelled |
| Checklist merge on chit user is currently editing | Replace checklist in form state, show toast notification |

## Settings Sync Flow

```
User changes a setting
    │
    ├─ Update local SettingsEntity (immediate)
    ├─ Set isDirty = true
    ├─ Apply to running app state
    │
    └─ Background:
        │
        ├─ Is online? ──No──→ Done (dirty state preserved for WorkManager)
        │
        └─ Yes → SyncPushEngine.pushAll()
                    │
                    ├─ Include settings in push request
                    │
                    ├─ "accepted" → clearDirty + update syncVersion
                    └─ "merged" → replace local with server version (LWW)
                                  → apply new values to running app state
```

## Attachment Sync Flow

```
Sync pull includes chit with attachments
    │
    └─ Store attachment metadata only (URL, filename, size)
       DO NOT download file content

User opens chit → views attachment
    │
    ├─ Check AttachmentCache for local file
    │   ├─ Cache HIT → serve from cache, update lastAccessedAt
    │   └─ Cache MISS → download from server
    │       ├─ Show progress indicator
    │       ├─ Store in cache on success
    │       └─ Show "Download when online" on failure
    │
User adds attachment to chit
    │
    ├─ Store file in cache immediately
    ├─ Create AttachmentMetadata with pendingUpload=true
    │
    ├─ Is online? ──No──→ Done (pendingUpload flag handles retry)
    │
    └─ Yes → Upload to server in background
                ├─ Success → update metadata with server URL, pendingUpload=false
                └─ Failure → retain pendingUpload=true for retry

Connectivity restored (offline → online)
    │
    └─ AttachmentManager.uploadPendingAttachments()
       → Upload all files where pendingUpload=true
```

## Notification Scheduling Flow

```
Chit synced/created with alert data
    │
    └─ NotificationScheduler.scheduleAlarms(chit)
        │
        ├─ Cancel any existing alarms for this chit
        ├─ Parse alert JSON → List<ChitAlert>
        ├─ For each alert with future trigger time:
        │   ├─ Has exact alarm permission?
        │   │   ├─ Yes → setExactAndAllowWhileIdle()
        │   │   └─ No → set() (inexact fallback)
        │   └─ Create PendingIntent with chit ID + alert type
        │
Chit alert data modified
    │
    └─ NotificationScheduler.scheduleAlarms(chit)  [same flow — cancel + reschedule]

Chit soft-deleted
    │
    └─ NotificationScheduler.cancelAlarms(chitId)

Device reboots
    │
    └─ BootReceiver.onReceive()
        └─ NotificationScheduler.rescheduleAll()
            └─ Read all chits with alerts from Room → schedule each

Alarm fires
    │
    └─ AlarmReceiver.onReceive()
        ├─ Determine channel from alert type
        ├─ Build notification with chit title
        ├─ Set tap action → open Chit Editor
        └─ Display notification
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Conflict banner visibility driven by entity state

*For any* ChitEntity, the editor's `showConflictBanner` state SHALL be `true` if and only if the entity's `hasUnviewedConflict` field is `true`. Dismissing the banner SHALL set `hasUnviewedConflict` to `false` on the local entity.

**Validates: Requirements 1.1, 1.4**


### Property 2: Merge response handling completeness

*For any* push response with status "merged" for a chit or contact, the local entity SHALL be updated with the server's merged field values, `hasUnviewedConflict` SHALL be `true`, `conflictFields` SHALL contain the server-returned field names, `isDirty` SHALL be `false`, and `dirtyFields` SHALL be `"[]"`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 5.3**


### Property 3: Contact and settings CRUD dirty tracking

*For any* local creation, edit, or deletion of a ContactEntity or SettingsEntity, the entity's `isDirty` field SHALL be `true` after the operation. For contacts, `dirtyFields` SHALL contain exactly the snake_case names of the changed fields with no duplicates.

**Validates: Requirements 4.1, 4.2, 4.3, 6.3**


### Property 4: Push request includes all dirty entities

*For any* set of dirty ChitEntity, ContactEntity, and SettingsEntity records, when `pushAll()` is called, the resulting `SyncPushRequestDto` SHALL contain exactly one entry for each dirty chit in `chits`, one entry for each dirty contact in `contacts`, and the settings object if settings are dirty. When no contacts are dirty, the `contacts` field SHALL be null or empty. When settings are not dirty, the `settings` field SHALL be null.

**Validates: Requirements 5.1, 18.1, 18.2, 18.3, 18.4, 18.5**


### Property 5: Push success clears dirty state

*For any* entity (chit, contact, or settings) with `isDirty = true`, when the server responds with status "accepted" or "created", the entity SHALL have `isDirty = false` and `syncVersion` updated to the server-returned version.

**Validates: Requirements 5.2, 6.5**


### Property 6: Push error preserves dirty state

*For any* entity (chit, contact, or settings) with `isDirty = true`, when the push fails (server "error" status or network failure), the entity's `isDirty` SHALL remain `true` and `dirtyFields` SHALL be unchanged.

**Validates: Requirements 5.5**


### Property 7: Settings merge uses LWW on entire record

*For any* settings push that receives a "merged" response, the local SettingsEntity SHALL be completely replaced with the server's version (no field-level merge). The resulting local settings SHALL exactly match the server-returned merged values.

**Validates: Requirements 7.1, 7.3**


### Property 8: Attachment metadata stored without file download

*For any* chit synced from the server that references attachments, the local AttachmentMetadata records SHALL contain the URL, filename, and size, but `localPath` SHALL be null (no file downloaded).

**Validates: Requirements 8.1**


### Property 9: Attachment cache hit avoids re-download

*For any* attachment where `localPath` is non-null and the file exists at that path, accessing the attachment SHALL return the cached file without making any network request.

**Validates: Requirements 8.5**


### Property 10: Cache eviction respects LRU ordering and pending uploads

*For any* cache state exceeding `maxSizeBytes`, after eviction: (a) the total cache size SHALL be at or below `maxSizeBytes`, (b) evicted files SHALL be those with the oldest `lastAccessedAt` timestamps, (c) no file with `pendingUpload = true` SHALL be evicted, and (d) metadata for evicted files SHALL be retained with `localPath = null`.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**


### Property 11: Alarm scheduling reflects current chit alert state

*For any* ChitEntity with N future alert times, after calling `scheduleAlarms(chit)`, exactly N alarms SHALL be registered with AlarmManager, each with the correct trigger time. If the chit previously had M alarms, those M alarms SHALL be cancelled before the N new ones are scheduled.

**Validates: Requirements 11.1, 11.2**


### Property 12: Soft-delete cancels all alarms

*For any* ChitEntity that is soft-deleted, all previously scheduled alarms for that chit SHALL be cancelled via AlarmManager.

**Validates: Requirements 11.3**


### Property 13: Notification channel routing by alert type

*For any* alarm trigger, the notification SHALL be posted to the channel matching the alert type: "alarm" → CHANNEL_ALARMS (high importance, sound+vibration), "reminder" → CHANNEL_REMINDERS (default importance, no sound), "timer" → CHANNEL_TIMERS (high importance, sound+vibration).

**Validates: Requirements 12.2, 12.3, 12.4**


### Property 14: Exact alarm permission fallback

*For any* alarm scheduling on API 31+ when `canScheduleExactAlarms()` returns `false`, the scheduler SHALL use `AlarmManager.set()` (inexact) instead of `setExactAndAllowWhileIdle()`.

**Validates: Requirements 13.3**


### Property 15: Server deletion overrides local edits

*For any* ChitEntity with local dirty edits, when a sync pull delivers `deleted = true` for that chit from the server, the local entity SHALL be marked `deleted = true`, `isDirty = false`, `dirtyFields = "[]"`, and a lost edit log entry SHALL be created containing the chit ID and the fields that were lost.

**Validates: Requirements 14.1, 14.2, 14.3**


### Property 16: Tag rename propagation without dirtying

*For any* tag rename operation (oldTag → newTag) received from the server, all local ChitEntity records containing `oldTag` in their `tags` array SHALL have it replaced with `newTag`, and none of those entities SHALL have their `isDirty` field changed to `true` as a result.

**Validates: Requirements 16.1, 16.2**


### Property 17: Checklist conflict uses LWW on entire blob

*For any* push response with status "merged" where `conflict_fields` contains "checklist", the local ChitEntity's `checklist` field SHALL be entirely replaced with the server's merged checklist value (no item-level merge attempted).

**Validates: Requirements 15.1, 15.2**


### Property 18: Migration v2→v3 preserves all existing data

*For any* set of ChitEntity records stored in a version-2 database, after executing MIGRATION_2_3, all original field values SHALL be preserved unchanged, and the new `conflictFields` column SHALL be `null` for every existing record.

**Validates: Requirements 17.3, 17.4**


### Property 19: Upload success updates metadata with server URL

*For any* attachment with `pendingUpload = true`, when the upload succeeds, the local AttachmentMetadata SHALL have `url` set to the server-returned URL and `pendingUpload` set to `false`.

**Validates: Requirements 9.5**


## Testing Strategy

Testing is optional per project conventions, but the design supports the following approach if tests are written:

### Property Tests (Kotlin — Kotest Property Testing)

Key candidates for property-based testing:

- **Merge response handling** (Property 2): Generate random merged responses with various field combinations, verify local entity state transitions
- **Dirty tracking for contacts** (Property 3): Generate random contact edits, verify dirty field detection correctness
- **Push request construction** (Property 4): Generate random combinations of dirty chits/contacts/settings, verify request includes all
- **Cache eviction** (Property 10): Generate random cache states with varying sizes and access times, verify LRU eviction respects constraints
- **Alarm scheduling** (Property 11): Generate random chits with varying alert counts and times, verify correct alarm count
- **Channel routing** (Property 13): Generate random alert types, verify correct channel selection
- **Server deletion override** (Property 15): Generate random dirty chits, apply server deletion, verify state cleared
- **Tag rename propagation** (Property 16): Generate random chit sets with various tags, apply rename, verify all updated without dirtying
- **Checklist LWW** (Property 17): Generate random local/server checklists, verify complete replacement

### Unit Tests (Example-Based)

- **Conflict banner**: Verify banner shown/hidden for specific entity states
- **Migration v2→v3**: Verify specific records survive migration with correct defaults
- **Notification channels**: Verify three channels created with correct importance levels
- **Permission fallback**: Verify inexact alarm used when permission denied
- **Lost edit logging**: Verify log entry created with correct fields

### Integration Tests

- **Full push flow with contacts+settings**: Mock server, create dirty records across all types, push, verify all processed
- **Attachment download→cache→re-access**: Mock server, download file, verify cached, access again without network
- **Boot receiver**: Simulate boot, verify all alarms re-registered
- **Reconnect uploads pending attachments**: Queue uploads offline, simulate reconnect, verify uploads triggered

### What NOT to Test

- Android AlarmManager actually firing alarms (trust the framework)
- NotificationChannel creation (trust Android notification system)
- Room migration runner execution (trust Room — test the SQL logic)
- File I/O operations (trust the OS filesystem)
- OkHttp file download streaming (trust the library)
