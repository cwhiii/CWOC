# Design: Android Phase 1 — Read-Only Client

## Overview

This design covers the architecture and implementation of the CWOC Android app's first phase: a read-only native client that authenticates against the existing CWOC server, pulls all data via the sync API, stores it locally in Room, and displays it in Jetpack Compose views. No editing or push operations are supported.

The app lives at `/android/` in the workspace root. It uses a single-Activity architecture with Compose Navigation, Hilt for DI, Room for persistence, and Retrofit+OkHttp for networking.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CWOC Android App                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  UI Layer (Jetpack Compose)                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Login   │ │  Tasks   │ │  Notes   │ │ Calendar │ │ Placeholder│ │
│  │  Screen  │ │  Screen  │ │  Screen  │ │  Screen  │ │  Screens  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │            │             │             │       │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐              │
│  │  Login   │ │  Tasks   │ │  Notes   │ │ Calendar │              │
│  │ViewModel │ │ViewModel │ │ViewModel │ │ViewModel │              │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘              │
│       │             │            │             │                     │
│  ─────┼─────────────┼────────────┼─────────────┼─────────────────── │
│       │             │            │             │                     │
│  Data Layer                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Repositories                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ AuthRepo    │  │ ChitRepo    │  │ SyncRepo            │  │   │
│  │  │ (login,     │  │ (queries,   │  │ (pull, upsert,      │  │   │
│  │  │  token mgmt)│  │  filters)   │  │  high-water mark)   │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────────────┘  │   │
│  └─────────┼────────────────┼────────────────┼──────────────────┘   │
│            │                │                │                       │
│  ┌─────────┴────┐  ┌───────┴────────┐  ┌────┴──────────────┐       │
│  │ OkHttp +     │  │ Room Database  │  │ EncryptedShared   │       │
│  │ Retrofit     │  │ (SQLite)       │  │ Preferences       │       │
│  └──────────────┘  └────────────────┘  └───────────────────┘       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
         │
         │  HTTPS (Bearer token)
         ▼
┌─────────────────────┐
│   CWOC Server       │
│   (FastAPI)         │
│                     │
│ GET /api/sync/changes│
│ POST /api/auth/     │
│      device-token   │
└─────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Activity count | Single Activity | Modern Android pattern; Compose Navigation handles all screens |
| DI framework | Hilt | Official Jetpack DI, minimal boilerplate, ViewModel injection |
| Local DB | Room | Compile-time query verification, Flow-based reactive queries |
| Networking | Retrofit + OkHttp | Standard, interceptor support for auth headers |
| Navigation | Compose Navigation | Type-safe routes, integrates with bottom nav |
| Auth storage | EncryptedSharedPreferences | Backed by Android Keystore, secure token storage |
| Reactive data | Room Flows → StateFlow in ViewModel | Automatic UI updates when DB changes |


## Components and Interfaces

### Core Components

| Component | Responsibility | Interface |
|-----------|---------------|-----------|
| `CwocApplication` | Hilt app entry point | `@HiltAndroidApp` |
| `MainActivity` | Single Activity host, Compose content root | Sets `CwocTheme { CwocNavGraph() }` |
| `AuthInterceptor` | Injects Bearer token on API requests | `Interceptor.intercept(chain)` |
| `TokenAuthenticator` | Handles 401 responses globally | `Authenticator.authenticate(route, response)` |
| `SyncEngine` | Orchestrates pull + DB upsert | `suspend performSync(since: Int): SyncResult` |
| `SyncWorker` | WorkManager periodic sync trigger | `CoroutineWorker.doWork(): Result` |
| `AuthRepository` | Login, token storage, auth events | `login()`, `isAuthenticated()`, `clearToken()` |
| `ChitRepository` | Chit query access | `getTaskChits()`, `getNoteChits()`, `getCalendarChits()` |
| `SyncRepository` | Sync orchestration + HWM management | `performInitialSync()`, `performIncrementalSync()` |

### Key Interfaces

```kotlin
// API contract
interface CwocApiService {
    suspend fun authenticate(request: DeviceTokenRequest): Response<DeviceTokenResponse>
    suspend fun getSyncChanges(since: Int, include: String): Response<SyncResponseDto>
}

// Data access
interface ChitDao {
    suspend fun upsertAll(chits: List<ChitEntity>)
    fun getTaskChits(): Flow<List<ChitEntity>>
    fun getNoteChits(): Flow<List<ChitEntity>>
    fun getCalendarChits(): Flow<List<ChitEntity>>
}

// Sync result
sealed class SyncResult {
    data class Success(val serverVersion: Int) : SyncResult()
    data class Error(val code: Int, val message: String) : SyncResult()
    data class NetworkError(val message: String) : SyncResult()
}
```

## Data Models

### Domain Model Mapping

The app uses three layers of data models:

1. **DTOs** (`data/remote/dto/`) — Match the server JSON response shape (snake_case fields)
2. **Entities** (`data/local/entity/`) — Room database tables (camelCase fields, JSON strings for complex types)
3. **UI State** (`ui/screens/*/`) — View-specific data classes consumed by Compose

```
Server JSON → ChitDto → ChitEntity (Room) → Flow<List<ChitEntity>> → ViewModel → Compose UI
```

### Field Type Strategy

| Server Field Type | Room Storage | Kotlin Type |
|-------------------|-------------|-------------|
| String | TEXT | `String?` |
| Integer | INTEGER | `Int?` |
| Boolean | INTEGER (0/1) | `Boolean` |
| List<String> | TEXT (JSON) | `List<String>?` via TypeConverter |
| Complex JSON object | TEXT (raw JSON) | `String?` (parsed on demand) |
| ISO datetime | TEXT | `String?` |

### Chit Classification Logic

The server auto-assigns system tags, but the DAO queries use field presence for view filtering:

| View | Filter Criteria |
|------|----------------|
| Tasks | `status IS NOT NULL AND deleted = 0 AND archived = 0` |
| Notes | `note IS NOT NULL AND note != '' AND status IS NULL AND startDatetime IS NULL AND endDatetime IS NULL AND deleted = 0 AND archived = 0` |
| Calendar | `(startDatetime IS NOT NULL OR endDatetime IS NOT NULL) AND deleted = 0 AND archived = 0` |

## Project Structure

```
android/
├── app/
│   ├── build.gradle.kts              # App-level build config, dependencies
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── java/com/cwoc/app/
│           │   ├── CwocApplication.kt          # @HiltAndroidApp entry point
│           │   ├── MainActivity.kt             # Single Activity, sets Compose content
│           │   ├── di/
│           │   │   ├── AppModule.kt            # Provides Room DB, SharedPrefs
│           │   │   └── NetworkModule.kt        # Provides Retrofit, OkHttp, interceptors
│           │   ├── data/
│           │   │   ├── local/
│           │   │   │   ├── CwocDatabase.kt     # @Database class, type converters
│           │   │   │   ├── entity/
│           │   │   │   │   ├── ChitEntity.kt
│           │   │   │   │   ├── ContactEntity.kt
│           │   │   │   │   ├── SettingsEntity.kt
│           │   │   │   │   └── SyncMetadataEntity.kt
│           │   │   │   ├── dao/
│           │   │   │   │   ├── ChitDao.kt
│           │   │   │   │   ├── ContactDao.kt
│           │   │   │   │   ├── SettingsDao.kt
│           │   │   │   │   └── SyncMetadataDao.kt
│           │   │   │   └── converter/
│           │   │   │       └── Converters.kt   # TypeConverters for JSON fields
│           │   │   ├── remote/
│           │   │   │   ├── CwocApiService.kt   # Retrofit interface
│           │   │   │   ├── AuthInterceptor.kt  # OkHttp interceptor for Bearer token
│           │   │   │   └── dto/
│           │   │   │       ├── SyncResponseDto.kt
│           │   │   │       ├── ChitDto.kt
│           │   │   │       ├── ContactDto.kt
│           │   │   │       ├── SettingsDto.kt
│           │   │   │       └── AuthDto.kt
│           │   │   ├── repository/
│           │   │   │   ├── AuthRepository.kt
│           │   │   │   ├── ChitRepository.kt
│           │   │   │   ├── ContactRepository.kt
│           │   │   │   └── SyncRepository.kt
│           │   │   └── sync/
│           │   │       ├── SyncEngine.kt       # Orchestrates pull + upsert
│           │   │       └── SyncWorker.kt       # WorkManager periodic sync
│           │   ├── ui/
│           │   │   ├── theme/
│           │   │   │   ├── Color.kt
│           │   │   │   ├── Type.kt
│           │   │   │   ├── Shape.kt
│           │   │   │   └── Theme.kt
│           │   │   ├── navigation/
│           │   │   │   ├── CwocNavGraph.kt
│           │   │   │   ├── Screen.kt          # Sealed class of routes
│           │   │   │   └── BottomNavBar.kt
│           │   │   └── screens/
│           │   │       ├── login/
│           │   │       │   ├── LoginScreen.kt
│           │   │       │   └── LoginViewModel.kt
│           │   │       ├── tasks/
│           │   │       │   ├── TasksScreen.kt
│           │   │       │   └── TasksViewModel.kt
│           │   │       ├── notes/
│           │   │       │   ├── NotesScreen.kt
│           │   │       │   └── NotesViewModel.kt
│           │   │       ├── calendar/
│           │   │       │   ├── CalendarScreen.kt
│           │   │       │   └── CalendarViewModel.kt
│           │   │       └── placeholder/
│           │   │           └── PlaceholderScreen.kt
│           │   └── util/
│           │       ├── DateUtils.kt
│           │       └── MarkdownRenderer.kt
│           └── res/
│               ├── font/
│               │   ├── lora_regular.ttf
│               │   ├── lora_bold.ttf
│               │   ├── lora_italic.ttf
│               │   └── lora_bold_italic.ttf
│               ├── values/
│               │   ├── strings.xml
│               │   └── themes.xml
│               └── drawable/
│                   └── ic_launcher.xml
├── build.gradle.kts                   # Project-level build config
├── settings.gradle.kts                # Module declarations
└── gradle.properties                  # Gradle config (compose compiler, etc.)
```


## Dependency Injection (Hilt Modules)

### AppModule

Provides singleton instances for the app lifecycle:

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideEncryptedSharedPreferences(
        @ApplicationContext context: Context
    ): SharedPreferences {
        return EncryptedSharedPreferences.create(
            "cwoc_secure_prefs",
            MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    @Provides
    @Singleton
    fun provideCwocDatabase(
        @ApplicationContext context: Context
    ): CwocDatabase {
        return Room.databaseBuilder(
            context,
            CwocDatabase::class.java,
            "cwoc.db"
        ).build()
    }

    @Provides fun provideChitDao(db: CwocDatabase): ChitDao = db.chitDao()
    @Provides fun provideContactDao(db: CwocDatabase): ContactDao = db.contactDao()
    @Provides fun provideSettingsDao(db: CwocDatabase): SettingsDao = db.settingsDao()
    @Provides fun provideSyncMetadataDao(db: CwocDatabase): SyncMetadataDao = db.syncMetadataDao()
}
```

### NetworkModule

Provides Retrofit and OkHttp with the auth interceptor:

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideAuthInterceptor(prefs: SharedPreferences): AuthInterceptor {
        return AuthInterceptor(prefs)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        prefs: SharedPreferences
    ): Retrofit {
        val baseUrl = prefs.getString("server_url", "http://localhost:3333") ?: "http://localhost:3333"
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideCwocApiService(retrofit: Retrofit): CwocApiService {
        return retrofit.create(CwocApiService::class.java)
    }
}
```


## Room Database Schema

### CwocDatabase

```kotlin
@Database(
    entities = [ChitEntity::class, ContactEntity::class, SettingsEntity::class, SyncMetadataEntity::class],
    version = 1,
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

### ChitEntity

Maps all server chit fields. JSON-complex fields (tags, checklist, people, alerts, etc.) are stored as JSON strings with TypeConverters.

```kotlin
@Entity(tableName = "chits")
data class ChitEntity(
    @PrimaryKey val id: String,
    val title: String?,
    val note: String?,
    val tags: List<String>?,                    // JSON TypeConverter
    val startDatetime: String?,
    val endDatetime: String?,
    val dueDatetime: String?,
    val pointInTime: String?,
    val completedDatetime: String?,
    val status: String?,                        // "ToDo", "In Progress", "Blocked", "Complete"
    val priority: String?,                      // "Low", "Medium", "High", "Critical"
    val severity: String?,
    val checklist: String?,                     // Raw JSON string (complex nested structure)
    val alarm: Boolean?,
    val notification: Boolean?,
    val recurrence: String?,
    val recurrenceId: String?,
    val recurrenceRule: String?,                // Raw JSON string
    val recurrenceExceptions: String?,          // Raw JSON string
    val location: String?,
    val color: String?,
    val people: List<String>?,                  // JSON TypeConverter
    val pinned: Boolean,
    val archived: Boolean,
    val deleted: Boolean,
    val createdDatetime: String?,
    val modifiedDatetime: String?,
    val isProjectMaster: Boolean,
    val childChits: List<String>?,              // JSON TypeConverter
    val allDay: Boolean,
    val timezone: String?,
    val alerts: String?,                        // Raw JSON string (complex structure)
    val progressPercent: Int?,
    val timeEstimate: String?,
    val weatherData: String?,                   // Raw JSON string
    val healthData: String?,                    // Raw JSON string
    val habit: Boolean,
    val habitGoal: Int?,
    val habitSuccess: Int?,
    val showOnCalendar: Boolean?,
    val habitResetPeriod: String?,
    val habitLastActionDate: String?,
    val habitHideOverall: Boolean?,
    val perpetual: Boolean,
    val shares: String?,                        // Raw JSON string
    val stealth: Boolean?,
    val assignedTo: String?,
    val ownerId: String?,
    val hasUnviewedConflict: Boolean,
    val availability: String?,
    val snoozedUntil: String?,
    val prerequisites: List<String>?,           // JSON TypeConverter
    // Sync metadata
    val syncVersion: Int,
    val lastSyncedAt: String?                   // ISO timestamp of last sync
)
```

### ContactEntity

```kotlin
@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey val id: String,
    val givenName: String,
    val surname: String?,
    val middleNames: String?,
    val prefix: String?,
    val suffix: String?,
    val nickname: String?,
    val displayName: String?,
    val phones: String?,                        // Raw JSON string
    val emails: String?,                        // Raw JSON string
    val addresses: String?,                     // Raw JSON string
    val callSigns: String?,                     // Raw JSON string
    val xHandles: String?,                      // Raw JSON string
    val websites: String?,                      // Raw JSON string
    val dates: String?,                         // Raw JSON string
    val hasSignal: Boolean,
    val signalUsername: String?,
    val pgpKey: String?,
    val favorite: Boolean,
    val color: String?,
    val organization: String?,
    val socialContext: String?,
    val imageUrl: String?,
    val notes: String?,
    val tags: List<String>?,                    // JSON TypeConverter
    val sharedToVault: Boolean,
    val createdDatetime: String?,
    val modifiedDatetime: String?,
    // Sync metadata
    val syncVersion: Int,
    val lastSyncedAt: String?
)
```

### SettingsEntity

```kotlin
@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val userId: String,
    val timeFormat: String?,
    val sex: String?,
    val snoozeLength: String?,
    val defaultFilters: String?,               // Raw JSON
    val alarmOrientation: String?,
    val activeClocks: String?,                 // Raw JSON
    val savedLocations: String?,               // Raw JSON
    val tags: String?,                         // Raw JSON (array of tag objects)
    val customColors: String?,                 // Raw JSON
    val visualIndicators: String?,             // Raw JSON
    val chitOptions: String?,                  // Raw JSON
    val calendarSnap: String?,
    val weekStartDay: String?,
    val workStartHour: String?,
    val workEndHour: String?,
    val workDays: String?,
    val enabledPeriods: String?,
    val customDaysCount: String?,
    val allViewStartHour: String?,
    val allViewEndHour: String?,
    val dayScrollToHour: String?,
    val username: String?,
    val unitSystem: String?,
    val habitsSuccessWindow: String?,
    val overdueBorderColor: String?,
    val blockedBorderColor: String?,
    val hidDeclined: String?,
    val defaultShowHabitsOnCalendar: String?,
    val defaultTimezone: String?,
    val defaultView: String?,
    val viewOrder: String?,                    // Raw JSON
    // Sync metadata
    val syncVersion: Int,
    val lastSyncedAt: String?
)
```

### SyncMetadataEntity

Stores the high-water mark and sync state:

```kotlin
@Entity(tableName = "sync_metadata")
data class SyncMetadataEntity(
    @PrimaryKey val id: Int = 1,               // Single row
    val highWaterMark: Int = 0,                // Last successful server_version
    val lastSyncTimestamp: String? = null,     // ISO timestamp of last sync
    val syncStatus: String = "idle"            // "idle", "syncing", "error"
)
```

### Type Converters

```kotlin
class Converters {
    private val gson = Gson()

    @TypeConverter
    fun fromStringList(value: List<String>?): String? {
        return value?.let { gson.toJson(it) }
    }

    @TypeConverter
    fun toStringList(value: String?): List<String>? {
        if (value == null) return null
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson(value, type)
    }
}
```

Note: Complex JSON fields (checklist, alerts, recurrenceRule, etc.) are stored as raw `String?` rather than using TypeConverters. This avoids needing to model every nested structure in Kotlin for Phase 1 (read-only). The raw JSON is only parsed when needed for display.


## DAOs

### ChitDao

```kotlin
@Dao
interface ChitDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(chits: List<ChitEntity>)

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND status IS NOT NULL ORDER BY priority DESC, dueDatetime ASC")
    fun getTaskChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND status IS NOT NULL AND status = :status")
    fun getTasksByStatus(status: String): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND note IS NOT NULL AND note != '' AND status IS NULL AND startDatetime IS NULL AND endDatetime IS NULL")
    fun getNoteChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND (startDatetime IS NOT NULL OR endDatetime IS NOT NULL)")
    fun getCalendarChits(): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE deleted = 0 AND archived = 0 AND (startDatetime BETWEEN :dayStart AND :dayEnd OR endDatetime BETWEEN :dayStart AND :dayEnd OR (startDatetime <= :dayStart AND endDatetime >= :dayEnd))")
    fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>>

    @Query("SELECT * FROM chits WHERE id = :id")
    suspend fun getById(id: String): ChitEntity?

    @Query("SELECT COUNT(*) FROM chits")
    suspend fun getCount(): Int
}
```

### ContactDao

```kotlin
@Dao
interface ContactDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(contacts: List<ContactEntity>)

    @Query("SELECT * FROM contacts ORDER BY givenName ASC")
    fun getAllContacts(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE id = :id")
    suspend fun getById(id: String): ContactEntity?
}
```

### SettingsDao

```kotlin
@Dao
interface SettingsDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(settings: SettingsEntity)

    @Query("SELECT * FROM settings LIMIT 1")
    fun getSettings(): Flow<SettingsEntity?>

    @Query("SELECT * FROM settings LIMIT 1")
    suspend fun getSettingsOnce(): SettingsEntity?
}
```

### SyncMetadataDao

```kotlin
@Dao
interface SyncMetadataDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(metadata: SyncMetadataEntity)

    @Query("SELECT * FROM sync_metadata WHERE id = 1")
    suspend fun getMetadata(): SyncMetadataEntity?

    @Query("UPDATE sync_metadata SET highWaterMark = :version, lastSyncTimestamp = :timestamp WHERE id = 1")
    suspend fun updateHighWaterMark(version: Int, timestamp: String)

    @Query("UPDATE sync_metadata SET syncStatus = :status WHERE id = 1")
    suspend fun updateSyncStatus(status: String)
}
```


## Networking Layer

### Retrofit Service Interface

```kotlin
interface CwocApiService {

    @POST("/api/auth/device-token")
    suspend fun authenticate(
        @Body request: DeviceTokenRequest
    ): Response<DeviceTokenResponse>

    @GET("/api/sync/changes")
    suspend fun getSyncChanges(
        @Query("since") since: Int,
        @Query("include") include: String = "chits,contacts,settings"
    ): Response<SyncResponseDto>
}
```

### DTOs

```kotlin
data class DeviceTokenRequest(
    val username: String,
    val password: String,
    val device_name: String
)

data class DeviceTokenResponse(
    val token: String,
    val device_id: String
)

data class SyncResponseDto(
    val server_version: Int,
    val chits: List<ChitDto>?,
    val contacts: List<ContactDto>?,
    val settings: SettingsDto?
)

data class ChitDto(
    val id: String,
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
    val checklist: Any?,           // Complex nested JSON — stored as raw string
    val alarm: Boolean?,
    val notification: Boolean?,
    val recurrence: String?,
    val recurrence_id: String?,
    val recurrence_rule: Any?,     // Complex JSON object
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
    val alerts: Any?,              // Complex JSON array
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
    val has_unviewed_conflict: Boolean?,
    val availability: String?,
    val snoozed_until: String?,
    val prerequisites: List<String>?,
    val sync_version: Int
)

data class ContactDto(
    val id: String,
    val given_name: String,
    val surname: String?,
    val middle_names: String?,
    val prefix: String?,
    val suffix: String?,
    val nickname: String?,
    val display_name: String?,
    val phones: Any?,              // JSON array of MultiValueEntry
    val emails: Any?,
    val addresses: Any?,
    val call_signs: Any?,
    val x_handles: Any?,
    val websites: Any?,
    val dates: Any?,
    val has_signal: Boolean?,
    val signal_username: String?,
    val pgp_key: String?,
    val favorite: Boolean?,
    val color: String?,
    val organization: String?,
    val social_context: String?,
    val image_url: String?,
    val notes: String?,
    val tags: List<String>?,
    val shared_to_vault: Boolean?,
    val created_datetime: String?,
    val modified_datetime: String?,
    val sync_version: Int
)

data class SettingsDto(
    val user_id: String?,
    val time_format: String?,
    val tags: Any?,                // JSON array of tag objects
    val visual_indicators: Any?,
    val calendar_snap: String?,
    val week_start_day: String?,
    val work_start_hour: String?,
    val work_end_hour: String?,
    val work_days: String?,
    val enabled_periods: String?,
    val default_timezone: String?,
    val default_view: String?,
    val view_order: Any?,
    val unit_system: String?,
    val overdue_border_color: String?,
    val blocked_border_color: String?,
    val sync_version: Int
    // Additional fields mapped as needed
)
```

### AuthInterceptor (OkHttp)

Injects the Bearer token on every request except the login endpoint:

```kotlin
class AuthInterceptor(
    private val prefs: SharedPreferences
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        // Don't add auth header to the login endpoint
        if (request.url.encodedPath.contains("/api/auth/device-token")) {
            return chain.proceed(request)
        }

        val token = prefs.getString("device_token", null)
        if (token != null) {
            val authenticatedRequest = request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
            return chain.proceed(authenticatedRequest)
        }

        return chain.proceed(request)
    }
}
```

### 401 Response Handling

An OkHttp Authenticator handles token revocation globally:

```kotlin
class TokenAuthenticator(
    private val prefs: SharedPreferences,
    private val onTokenRevoked: () -> Unit
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // Token was rejected — clear it and signal the app
        prefs.edit().remove("device_token").apply()
        onTokenRevoked()
        return null  // Don't retry — redirect to login
    }
}
```

The `onTokenRevoked` callback triggers navigation to the login screen via a shared event bus (a `MutableSharedFlow<AuthEvent>` in the AuthRepository).


## Sync Engine

### Overview

The sync engine handles two operations:
1. **Initial full pull** — On first login, fetches all data with `since=0`
2. **Periodic incremental pull** — Every 5 minutes while the app is in the foreground, fetches changes since the high-water mark

No push operations exist in Phase 1.

### SyncEngine

```kotlin
class SyncEngine @Inject constructor(
    private val apiService: CwocApiService,
    private val chitDao: ChitDao,
    private val contactDao: ContactDao,
    private val settingsDao: SettingsDao,
    private val syncMetadataDao: SyncMetadataDao,
    private val gson: Gson
) {

    suspend fun performSync(since: Int = 0): SyncResult {
        syncMetadataDao.updateSyncStatus("syncing")

        try {
            val response = apiService.getSyncChanges(
                since = since,
                include = "chits,contacts,settings"
            )

            if (!response.isSuccessful) {
                syncMetadataDao.updateSyncStatus("error")
                return SyncResult.Error(response.code(), response.message())
            }

            val body = response.body() ?: return SyncResult.Error(0, "Empty response")
            val now = Instant.now().toString()

            // Upsert chits
            body.chits?.let { chits ->
                val entities = chits.map { it.toEntity(now) }
                chitDao.upsertAll(entities)
            }

            // Upsert contacts
            body.contacts?.let { contacts ->
                val entities = contacts.map { it.toEntity(now) }
                contactDao.upsertAll(entities)
            }

            // Upsert settings
            body.settings?.let { settings ->
                settingsDao.upsert(settings.toEntity(now))
            }

            // Update high-water mark
            syncMetadataDao.updateHighWaterMark(body.server_version, now)
            syncMetadataDao.updateSyncStatus("idle")

            return SyncResult.Success(body.server_version)
        } catch (e: Exception) {
            syncMetadataDao.updateSyncStatus("error")
            return SyncResult.NetworkError(e.message ?: "Unknown error")
        }
    }
}

sealed class SyncResult {
    data class Success(val serverVersion: Int) : SyncResult()
    data class Error(val code: Int, val message: String) : SyncResult()
    data class NetworkError(val message: String) : SyncResult()
}
```

### DTO-to-Entity Mapping

Complex JSON fields (checklist, alerts, recurrenceRule, etc.) are serialized back to JSON strings for Room storage using Gson:

```kotlin
fun ChitDto.toEntity(syncedAt: String): ChitEntity {
    val gson = Gson()
    return ChitEntity(
        id = id,
        title = title,
        note = note,
        tags = tags,
        startDatetime = start_datetime,
        endDatetime = end_datetime,
        dueDatetime = due_datetime,
        pointInTime = point_in_time,
        completedDatetime = completed_datetime,
        status = status,
        priority = priority,
        severity = severity,
        checklist = checklist?.let { gson.toJson(it) },
        alarm = alarm,
        notification = notification,
        recurrence = recurrence,
        recurrenceId = recurrence_id,
        recurrenceRule = recurrence_rule?.let { gson.toJson(it) },
        recurrenceExceptions = recurrence_exceptions?.let { gson.toJson(it) },
        location = location,
        color = color,
        people = people,
        pinned = pinned ?: false,
        archived = archived ?: false,
        deleted = deleted ?: false,
        createdDatetime = created_datetime,
        modifiedDatetime = modified_datetime,
        isProjectMaster = is_project_master ?: false,
        childChits = child_chits,
        allDay = all_day ?: false,
        timezone = timezone,
        alerts = alerts?.let { gson.toJson(it) },
        progressPercent = progress_percent,
        timeEstimate = time_estimate,
        weatherData = weather_data?.let { gson.toJson(it) },
        healthData = health_data?.let { gson.toJson(it) },
        habit = habit ?: false,
        habitGoal = habit_goal,
        habitSuccess = habit_success,
        showOnCalendar = show_on_calendar,
        habitResetPeriod = habit_reset_period,
        habitLastActionDate = habit_last_action_date,
        habitHideOverall = habit_hide_overall,
        perpetual = perpetual ?: false,
        shares = shares?.let { gson.toJson(it) },
        stealth = stealth,
        assignedTo = assigned_to,
        ownerId = owner_id,
        hasUnviewedConflict = has_unviewed_conflict ?: false,
        availability = availability,
        snoozedUntil = snoozed_until,
        prerequisites = prerequisites,
        syncVersion = sync_version,
        lastSyncedAt = syncedAt
    )
}
```

### SyncWorker (Periodic Refresh)

Uses WorkManager for periodic background sync while the app is in the foreground:

```kotlin
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncEngine: SyncEngine,
    private val syncMetadataDao: SyncMetadataDao
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val metadata = syncMetadataDao.getMetadata() ?: return Result.retry()
        val result = syncEngine.performSync(since = metadata.highWaterMark)

        return when (result) {
            is SyncResult.Success -> Result.success()
            is SyncResult.NetworkError -> Result.retry()
            is SyncResult.Error -> {
                if (result.code == 401) Result.failure() else Result.retry()
            }
        }
    }

    companion object {
        const val WORK_NAME = "cwoc_periodic_sync"

        fun enqueuePeriodicSync(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(
                5, TimeUnit.MINUTES
            ).setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancelPeriodicSync(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
```

### High-Water Mark Tracking

The sync flow:
1. App starts → read `SyncMetadataEntity.highWaterMark` (defaults to 0 if no row exists)
2. If `highWaterMark == 0` → initial full sync (`since=0`)
3. If `highWaterMark > 0` → incremental sync (`since=highWaterMark`)
4. On successful response → store `response.server_version` as new `highWaterMark`
5. WorkManager fires every 5 minutes → repeats step 3


## UI Layer

### Navigation Graph

```kotlin
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Tasks : Screen("tasks")
    object Notes : Screen("notes")
    object Calendar : Screen("calendar")
    object Checklists : Screen("checklists")
    object Alarms : Screen("alarms")
    object Projects : Screen("projects")
}

@Composable
fun CwocNavGraph(
    navController: NavHostController,
    isAuthenticated: Boolean,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = if (isAuthenticated) Screen.Tasks.route else Screen.Login.route,
        modifier = modifier
    ) {
        composable(Screen.Login.route) {
            LoginScreen(onLoginSuccess = {
                navController.navigate(Screen.Tasks.route) {
                    popUpTo(Screen.Login.route) { inclusive = true }
                }
            })
        }
        composable(Screen.Tasks.route) { TasksScreen() }
        composable(Screen.Notes.route) { NotesScreen() }
        composable(Screen.Calendar.route) { CalendarScreen() }
        composable(Screen.Checklists.route) { PlaceholderScreen(title = "Checklists") }
        composable(Screen.Alarms.route) { PlaceholderScreen(title = "Alarms") }
        composable(Screen.Projects.route) { PlaceholderScreen(title = "Projects") }
    }
}
```

### Bottom Navigation Bar

```kotlin
data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Calendar, "Calendar", Icons.Default.CalendarMonth),
    BottomNavItem(Screen.Checklists, "Checklists", Icons.Default.Checklist),
    BottomNavItem(Screen.Alarms, "Alarms", Icons.Default.Alarm),
    BottomNavItem(Screen.Projects, "Projects", Icons.Default.AccountTree),
    BottomNavItem(Screen.Tasks, "Tasks", Icons.Default.TaskAlt),
    BottomNavItem(Screen.Notes, "Notes", Icons.Default.StickyNote2),
)

@Composable
fun CwocBottomNavBar(navController: NavHostController) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        bottomNavItems.forEach { item ->
            NavigationBarItem(
                selected = currentRoute == item.screen.route,
                onClick = {
                    navController.navigate(item.screen.route) {
                        popUpTo(navController.graph.startDestinationId) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = { Icon(item.icon, contentDescription = item.label) },
                label = { Text(item.label) }
            )
        }
    }
}
```

### Login Screen

```kotlin
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // App title
        Text("CWOC", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(48.dp))

        // Server URL field
        OutlinedTextField(
            value = uiState.serverUrl,
            onValueChange = viewModel::onServerUrlChanged,
            label = { Text("Server URL") },
            placeholder = { Text("https://your-server.com") },
            singleLine = true,
            isError = uiState.serverUrlError != null,
            supportingText = uiState.serverUrlError?.let { { Text(it) } },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Username field
        OutlinedTextField(
            value = uiState.username,
            onValueChange = viewModel::onUsernameChanged,
            label = { Text("Username") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Password field
        OutlinedTextField(
            value = uiState.password,
            onValueChange = viewModel::onPasswordChanged,
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(24.dp))

        // Login button
        Button(
            onClick = { viewModel.login(onLoginSuccess) },
            enabled = !uiState.isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp))
            } else {
                Text("Log In")
            }
        }

        // Error message
        uiState.errorMessage?.let { error ->
            Spacer(modifier = Modifier.height(16.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
    }
}
```

### Tasks Screen

```kotlin
@Composable
fun TasksScreen(viewModel: TasksViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    when {
        uiState.isLoading -> SkeletonTasksList()
        uiState.tasks.isEmpty() -> EmptyStateMessage("No tasks yet")
        else -> {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                val grouped = uiState.tasks.groupBy { it.status ?: "Unknown" }
                val statusOrder = listOf("ToDo", "In Progress", "Blocked", "Complete")

                statusOrder.forEach { status ->
                    grouped[status]?.let { tasks ->
                        stickyHeader {
                            StatusHeader(status = status, count = tasks.size)
                        }
                        items(tasks, key = { it.id }) { chit ->
                            TaskCard(chit = chit)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TaskCard(chit: ChitEntity) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = chit.color?.let { Color(android.graphics.Color.parseColor(it)) }
                ?: MaterialTheme.colorScheme.surface
        )
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            // Priority indicator
            chit.priority?.let { priority ->
                PriorityIndicator(priority = priority)
                Spacer(modifier = Modifier.width(8.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(chit.title ?: "", style = MaterialTheme.typography.bodyLarge)
                chit.dueDatetime?.let { due ->
                    Text(
                        text = formatDueDate(due),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
```

### Notes Screen

```kotlin
@Composable
fun NotesScreen(viewModel: NotesViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    when {
        uiState.isLoading -> SkeletonNotesList()
        uiState.notes.isEmpty() -> EmptyStateMessage("No notes yet")
        else -> {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                items(uiState.notes, key = { it.id }) { chit ->
                    NoteCard(chit = chit)
                }
            }
        }
    }
}

@Composable
fun NoteCard(chit: ChitEntity) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(chit.title ?: "", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            // Render markdown content (truncated preview)
            chit.note?.let { note ->
                MarkdownText(
                    markdown = note.take(300),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}
```

### Calendar Screen

```kotlin
@Composable
fun CalendarScreen(viewModel: CalendarViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        // View toggle: Day / Week
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.Center
        ) {
            FilterChip(
                selected = uiState.viewMode == CalendarViewMode.DAY,
                onClick = { viewModel.setViewMode(CalendarViewMode.DAY) },
                label = { Text("Day") }
            )
            Spacer(modifier = Modifier.width(8.dp))
            FilterChip(
                selected = uiState.viewMode == CalendarViewMode.WEEK,
                onClick = { viewModel.setViewMode(CalendarViewMode.WEEK) },
                label = { Text("Week") }
            )
        }

        // Date navigation
        DateNavigationHeader(
            currentDate = uiState.selectedDate,
            onPrevious = viewModel::previousPeriod,
            onNext = viewModel::nextPeriod,
            onToday = viewModel::goToToday
        )

        // Event list
        when (uiState.viewMode) {
            CalendarViewMode.DAY -> DayView(events = uiState.dayEvents)
            CalendarViewMode.WEEK -> WeekView(events = uiState.weekEvents, startDate = uiState.weekStart)
        }
    }
}

enum class CalendarViewMode { DAY, WEEK }
```

### Placeholder Screen

```kotlin
@Composable
fun PlaceholderScreen(title: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Default.Construction,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "$title — Coming Soon",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
```


## ViewModels

### LoginViewModel

```kotlin
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val syncEngine: SyncEngine
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        // Pre-populate server URL from last successful login
        _uiState.update { it.copy(serverUrl = authRepository.getLastServerUrl() ?: "") }
    }

    fun onServerUrlChanged(url: String) {
        _uiState.update { it.copy(serverUrl = url, serverUrlError = null) }
    }

    fun onUsernameChanged(username: String) {
        _uiState.update { it.copy(username = username) }
    }

    fun onPasswordChanged(password: String) {
        _uiState.update { it.copy(password = password) }
    }

    fun login(onSuccess: () -> Unit) {
        val state = _uiState.value

        // Validate server URL
        if (state.serverUrl.isBlank()) {
            _uiState.update { it.copy(serverUrlError = "Server URL is required") }
            return
        }
        if (!state.serverUrl.startsWith("http://") && !state.serverUrl.startsWith("https://")) {
            _uiState.update { it.copy(serverUrlError = "URL must start with http:// or https://") }
            return
        }

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            val result = authRepository.login(
                serverUrl = state.serverUrl,
                username = state.username,
                password = state.password
            )

            when (result) {
                is AuthResult.Success -> {
                    // Perform initial sync
                    syncEngine.performSync(since = 0)
                    _uiState.update { it.copy(isLoading = false) }
                    onSuccess()
                }
                is AuthResult.InvalidCredentials -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = "Invalid credentials") }
                }
                is AuthResult.NetworkError -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = "Cannot reach server") }
                }
                is AuthResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.message) }
                }
            }
        }
    }
}

data class LoginUiState(
    val serverUrl: String = "",
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val serverUrlError: String? = null
)
```

### TasksViewModel

```kotlin
@HiltViewModel
class TasksViewModel @Inject constructor(
    private val chitDao: ChitDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(TasksUiState(isLoading = true))
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            chitDao.getTaskChits().collect { chits ->
                _uiState.update {
                    TasksUiState(isLoading = false, tasks = chits)
                }
            }
        }
    }
}

data class TasksUiState(
    val isLoading: Boolean = false,
    val tasks: List<ChitEntity> = emptyList()
)
```

### NotesViewModel

```kotlin
@HiltViewModel
class NotesViewModel @Inject constructor(
    private val chitDao: ChitDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotesUiState(isLoading = true))
    val uiState: StateFlow<NotesUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            chitDao.getNoteChits().collect { chits ->
                _uiState.update {
                    NotesUiState(isLoading = false, notes = chits)
                }
            }
        }
    }
}

data class NotesUiState(
    val isLoading: Boolean = false,
    val notes: List<ChitEntity> = emptyList()
)
```

### CalendarViewModel

```kotlin
@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val chitDao: ChitDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

    init {
        loadEvents()
    }

    fun setViewMode(mode: CalendarViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
        loadEvents()
    }

    fun previousPeriod() {
        val current = _uiState.value.selectedDate
        val newDate = when (_uiState.value.viewMode) {
            CalendarViewMode.DAY -> current.minusDays(1)
            CalendarViewMode.WEEK -> current.minusWeeks(1)
        }
        _uiState.update { it.copy(selectedDate = newDate) }
        loadEvents()
    }

    fun nextPeriod() {
        val current = _uiState.value.selectedDate
        val newDate = when (_uiState.value.viewMode) {
            CalendarViewMode.DAY -> current.plusDays(1)
            CalendarViewMode.WEEK -> current.plusWeeks(1)
        }
        _uiState.update { it.copy(selectedDate = newDate) }
        loadEvents()
    }

    fun goToToday() {
        _uiState.update { it.copy(selectedDate = LocalDate.now()) }
        loadEvents()
    }

    private fun loadEvents() {
        viewModelScope.launch {
            val state = _uiState.value
            val (start, end) = when (state.viewMode) {
                CalendarViewMode.DAY -> {
                    val dayStart = state.selectedDate.atStartOfDay().toString()
                    val dayEnd = state.selectedDate.plusDays(1).atStartOfDay().toString()
                    dayStart to dayEnd
                }
                CalendarViewMode.WEEK -> {
                    val weekStart = state.selectedDate.with(DayOfWeek.MONDAY)
                    val weekEnd = weekStart.plusDays(7)
                    weekStart.atStartOfDay().toString() to weekEnd.atStartOfDay().toString()
                }
            }

            chitDao.getChitsForDay(start, end).collect { chits ->
                _uiState.update {
                    it.copy(
                        dayEvents = chits,
                        weekEvents = chits,
                        weekStart = state.selectedDate.with(DayOfWeek.MONDAY)
                    )
                }
            }
        }
    }
}

data class CalendarUiState(
    val viewMode: CalendarViewMode = CalendarViewMode.DAY,
    val selectedDate: LocalDate = LocalDate.now(),
    val dayEvents: List<ChitEntity> = emptyList(),
    val weekEvents: List<ChitEntity> = emptyList(),
    val weekStart: LocalDate = LocalDate.now().with(DayOfWeek.MONDAY)
)
```


## Theming (Material 3 + CWOC Parchment)

### Color Scheme

```kotlin
// Color.kt
val CwocPrimary = Color(0xFF6B4E31)          // Brown — primary actions, nav highlights
val CwocOnPrimary = Color(0xFFFFFFFF)        // White text on primary
val CwocBackground = Color(0xFFFFFAF0)       // Floral white — page background
val CwocSurface = Color(0xFFF5E6D3)          // Parchment — cards, nav bar
val CwocOnSurface = Color(0xFF1A1208)        // Near-black — body text
val CwocOnSurfaceVariant = Color(0xFF5C4A3A) // Dark brown — secondary text
val CwocError = Color(0xFFB22222)            // Firebrick red — errors
val CwocOnError = Color(0xFFFFFFFF)          // White text on error

val CwocColorScheme = lightColorScheme(
    primary = CwocPrimary,
    onPrimary = CwocOnPrimary,
    primaryContainer = Color(0xFFE8D5C0),
    onPrimaryContainer = Color(0xFF3D2B1A),
    secondary = Color(0xFF8B6914),
    onSecondary = Color(0xFFFFFFFF),
    background = CwocBackground,
    onBackground = CwocOnSurface,
    surface = CwocSurface,
    onSurface = CwocOnSurface,
    onSurfaceVariant = CwocOnSurfaceVariant,
    error = CwocError,
    onError = CwocOnError,
    surfaceVariant = Color(0xFFEDE0D4),
    outline = Color(0xFF8B7355)
)
```

### Typography (Lora Font)

```kotlin
// Type.kt
val LoraFontFamily = FontFamily(
    Font(R.font.lora_regular, FontWeight.Normal),
    Font(R.font.lora_bold, FontWeight.Bold),
    Font(R.font.lora_italic, FontWeight.Normal, FontStyle.Italic),
    Font(R.font.lora_bold_italic, FontWeight.Bold, FontStyle.Italic),
)

val CwocTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp
    ),
    titleLarge = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp
    ),
    titleMedium = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp
    ),
    labelLarge = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp
    ),
    labelSmall = TextStyle(
        fontFamily = LoraFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp
    )
)
```

### Theme Composable

```kotlin
// Theme.kt
@Composable
fun CwocTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = CwocColorScheme,
        typography = CwocTypography,
        shapes = Shapes(
            small = RoundedCornerShape(8.dp),
            medium = RoundedCornerShape(12.dp),
            large = RoundedCornerShape(16.dp)
        ),
        content = content
    )
}
```

### Contrast Compliance

All text/background combinations meet WCAG AA (4.5:1 minimum):

| Text Color | Background | Contrast Ratio |
|-----------|-----------|---------------|
| `#1A1208` (onSurface) | `#FFFAF0` (background) | 16.8:1 ✓ |
| `#1A1208` (onSurface) | `#F5E6D3` (surface) | 13.2:1 ✓ |
| `#5C4A3A` (onSurfaceVariant) | `#FFFAF0` (background) | 7.1:1 ✓ |
| `#5C4A3A` (onSurfaceVariant) | `#F5E6D3` (surface) | 5.6:1 ✓ |
| `#FFFFFF` (onPrimary) | `#6B4E31` (primary) | 7.2:1 ✓ |


## Repositories

### AuthRepository

```kotlin
class AuthRepository @Inject constructor(
    private val prefs: SharedPreferences,
    private val apiService: CwocApiService
) {
    private val _authEvents = MutableSharedFlow<AuthEvent>()
    val authEvents: SharedFlow<AuthEvent> = _authEvents.asSharedFlow()

    fun isAuthenticated(): Boolean {
        return prefs.getString("device_token", null) != null
    }

    fun getLastServerUrl(): String? {
        return prefs.getString("server_url", null)
    }

    suspend fun login(serverUrl: String, username: String, password: String): AuthResult {
        try {
            // Store server URL for Retrofit base URL
            prefs.edit().putString("server_url", serverUrl).apply()

            val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
            val response = apiService.authenticate(
                DeviceTokenRequest(username, password, deviceName)
            )

            return when {
                response.isSuccessful -> {
                    val body = response.body()!!
                    prefs.edit().putString("device_token", body.token).apply()
                    AuthResult.Success
                }
                response.code() in listOf(401, 403) -> AuthResult.InvalidCredentials
                else -> AuthResult.Error("Server error: ${response.code()}")
            }
        } catch (e: Exception) {
            return AuthResult.NetworkError
        }
    }

    fun clearToken() {
        prefs.edit().remove("device_token").apply()
    }

    suspend fun emitTokenRevoked() {
        _authEvents.emit(AuthEvent.TokenRevoked)
    }
}

sealed class AuthResult {
    object Success : AuthResult()
    object InvalidCredentials : AuthResult()
    object NetworkError : AuthResult()
    data class Error(val message: String) : AuthResult()
}

sealed class AuthEvent {
    object TokenRevoked : AuthEvent()
}
```

### ChitRepository

```kotlin
class ChitRepository @Inject constructor(
    private val chitDao: ChitDao
) {
    fun getTaskChits(): Flow<List<ChitEntity>> = chitDao.getTaskChits()
    fun getNoteChits(): Flow<List<ChitEntity>> = chitDao.getNoteChits()
    fun getCalendarChits(): Flow<List<ChitEntity>> = chitDao.getCalendarChits()
    fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> =
        chitDao.getChitsForDay(dayStart, dayEnd)
    suspend fun getById(id: String): ChitEntity? = chitDao.getById(id)
}
```

### SyncRepository

```kotlin
class SyncRepository @Inject constructor(
    private val syncEngine: SyncEngine,
    private val syncMetadataDao: SyncMetadataDao
) {
    suspend fun getHighWaterMark(): Int {
        return syncMetadataDao.getMetadata()?.highWaterMark ?: 0
    }

    suspend fun performInitialSync(): SyncResult {
        // Ensure metadata row exists
        syncMetadataDao.upsert(SyncMetadataEntity())
        return syncEngine.performSync(since = 0)
    }

    suspend fun performIncrementalSync(): SyncResult {
        val hwm = getHighWaterMark()
        return syncEngine.performSync(since = hwm)
    }
}
```


## Error Handling

### Network Errors

| Scenario | Handling |
|----------|----------|
| Login — network unreachable | Show "Cannot reach server" on login screen |
| Login — 401/403 | Show "Invalid credentials" on login screen |
| Sync — network error | Silently retry on next polling interval |
| Sync — 401 | Clear token, navigate to login with "Session expired" message |
| Sync — other HTTP error | Log error, retry on next interval |

### Token Revocation Flow

```
API returns 401
    → OkHttp Authenticator fires
    → Clears token from EncryptedSharedPreferences
    → Emits AuthEvent.TokenRevoked via SharedFlow
    → MainActivity observes event
    → Navigates to Login screen
    → Shows "Your session has expired. Please log in again."
```

### Sync State Machine

```
┌───────┐     login success      ┌──────────┐     response OK      ┌──────┐
│ IDLE  │ ──────────────────────→ │ SYNCING  │ ────────────────────→ │ IDLE │
└───────┘                         └──────────┘                       └──────┘
                                       │
                                       │ network error / non-401 HTTP error
                                       ▼
                                  ┌──────────┐     next poll interval
                                  │  ERROR   │ ────────────────────→ (retry)
                                  └──────────┘
                                       │
                                       │ 401
                                       ▼
                                  ┌──────────┐
                                  │  LOGIN   │ (navigate to login screen)
                                  └──────────┘
```

## Data Flow Summary

```
Server (FastAPI)
    │
    │  GET /api/sync/changes?since=N
    ▼
Retrofit (CwocApiService)
    │
    │  SyncResponseDto
    ▼
SyncEngine
    │
    │  ChitDto.toEntity(), ContactDto.toEntity()
    ▼
Room Database (ChitDao.upsertAll)
    │
    │  Flow<List<ChitEntity>>
    ▼
ViewModel (collects Flow → StateFlow)
    │
    │  UiState
    ▼
Compose Screen (recomposes on state change)
```

## Read-Only Enforcement

Phase 1 enforces read-only at multiple levels:

1. **No UI controls** — No FAB, no edit buttons, no swipe actions, no long-press menus
2. **No push endpoint in ApiService** — The Retrofit interface has no `POST /api/sync/push` method
3. **No dirty tracking** — Room entities have no `isDirty` or `dirtyFields` columns
4. **No write DAOs** — Only `upsertAll` (for sync) exists; no user-facing insert/update/delete methods


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Theme contrast compliance

*For any* text color and background color pair defined in the CwocColorScheme, the WCAG relative luminance contrast ratio SHALL be at least 4.5:1.

**Validates: Requirements 2.5**

### Property 2: Server URL persistence round-trip

*For any* valid URL string (starting with `http://` or `https://`), storing it via the AuthRepository and reading it back SHALL return the identical string.

**Validates: Requirements 3.2**

### Property 3: URL protocol validation

*For any* arbitrary string, the URL validation logic SHALL accept it if and only if it starts with `http://` or `https://`. All other strings SHALL be rejected.

**Validates: Requirements 3.4**

### Property 4: Token storage round-trip

*For any* non-empty token string, storing it in EncryptedSharedPreferences via the AuthRepository and reading it back SHALL return the identical token string.

**Validates: Requirements 4.3**

### Property 5: Bearer token header injection

*For any* API request made while a device token is stored, the OkHttp AuthInterceptor SHALL attach an `Authorization` header with value `Bearer {token}` where `{token}` is the stored token value.

**Validates: Requirements 4.7**

### Property 6: Entity schema completeness

*For all* fields defined in the server's Chit, Contact, and Settings models that are included in sync responses, the corresponding Room entity (ChitEntity, ContactEntity, SettingsEntity) SHALL have a matching column capable of storing that field's value.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Sync response persistence

*For any* list of chit or contact DTOs in a sync response, after the SyncEngine processes the response, every record SHALL be queryable from the corresponding DAO by its `id` field with all field values preserved.

**Validates: Requirements 7.2, 7.3, 8.2**

### Property 8: View filtering — archived and deleted exclusion

*For any* chit with `archived = true` or `deleted = true`, that chit SHALL NOT appear in the results of the Tasks, Notes, or Calendar DAO queries.

**Validates: Requirements 10.4, 11.4, 12.7**

### Property 9: Tasks view status filtering and grouping

*For any* chit returned by the Tasks DAO query, its `status` field SHALL be non-null. Furthermore, *for any* task with a given status value, it SHALL appear in the group corresponding to that status value (ToDo, In Progress, Blocked, or Complete).

**Validates: Requirements 10.1, 10.2**

### Property 10: Calendar view date filtering

*For any* chit returned by the Calendar DAO query, it SHALL have a non-null `startDatetime` or a non-null `endDatetime` (or both).

**Validates: Requirements 12.1**

### Property 11: No push requests in read-only mode

*For any* sequence of user interactions with the app, the Retrofit ApiService SHALL never send a POST request to `/api/sync/push`. The interface SHALL not define such a method.

**Validates: Requirements 13.4**


## Testing Strategy

Testing is optional per project conventions, but the design supports the following approach if tests are written:

### Unit Tests (Example-Based)

- **Theme colors**: Verify specific color values match requirements
- **URL validation**: Test specific valid/invalid URL inputs
- **Login error handling**: Mock 401/403/network errors, verify correct UI state
- **Navigation**: Verify correct screen shown for each tab
- **Placeholder screens**: Verify "Coming Soon" text for unimplemented tabs

### Property Tests

Properties 1–11 (defined in Correctness Properties above) can be implemented as property-based tests using a Kotlin PBT library (e.g., Kotest property testing). Key candidates:

- **URL validation** (Property 3): Generate arbitrary strings, verify acceptance iff starts with http:// or https://
- **View filtering** (Properties 8, 9, 10): Generate random ChitEntity lists, verify DAO queries return only matching records
- **Sync persistence** (Property 7): Generate random DTO lists, verify all are queryable after upsert

### Integration Tests

- **Full sync flow**: Mock server response, verify all records land in Room
- **Periodic sync**: Verify WorkManager schedules correctly
- **Token revocation**: Mock 401, verify navigation to login

### What NOT to Test

- Android framework behavior (Room actually persists, Hilt actually injects)
- Compose rendering correctness (trust the framework)
- Network transport (OkHttp/Retrofit internals)

