# Implementation Plan: Android Phase 1 — Read-Only Client

## Overview

Build the CWOC Android app as a read-only native client using Kotlin, Jetpack Compose, Hilt, Room, and Retrofit. The implementation proceeds from project scaffolding → data layer → networking → sync engine → UI screens → wiring. All code lives at `/android/` in the workspace root.

## Tasks

- [x] 1. Project scaffolding and build configuration
  - [x] 1.1 Create Android project structure with Gradle build files
    - Create `android/build.gradle.kts` (project-level) with Kotlin, Hilt, and Compose plugins
    - Create `android/settings.gradle.kts` with module declarations
    - Create `android/gradle.properties` with Compose compiler and AndroidX settings
    - Create `android/app/build.gradle.kts` with all dependencies: Compose, Hilt, Room, Retrofit, OkHttp, Gson, WorkManager, EncryptedSharedPreferences, Compose Navigation
    - Set `minSdk = 26`, `targetSdk = 34`, `applicationId = "com.cwoc.app"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 1.2 Create AndroidManifest.xml and application entry point
    - Create `android/app/src/main/AndroidManifest.xml` with INTERNET permission and application declaration
    - Create `CwocApplication.kt` with `@HiltAndroidApp` annotation
    - Create `MainActivity.kt` as single-Activity host setting Compose content with `CwocTheme { CwocNavGraph() }`
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 2. Theming and visual foundation
  - [x] 2.1 Implement Material 3 CWOC parchment theme
    - Create `ui/theme/Color.kt` with CwocPrimary (`#6B4E31`), CwocBackground (`#FFFAF0`), CwocSurface (`#F5E6D3`), and full color scheme
    - Create `ui/theme/Type.kt` with Lora font family and typography scale
    - Create `ui/theme/Shape.kt` with rounded corner shapes
    - Create `ui/theme/Theme.kt` with `CwocTheme` composable applying the color scheme, typography, and shapes
    - Add Lora font files (regular, bold, italic, bold-italic) to `res/font/`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Local database layer (Room)
  - [x] 3.1 Create Room entities
    - Create `data/local/entity/ChitEntity.kt` with all fields from the design (id, title, note, tags, dates, status, priority, etc.)
    - Create `data/local/entity/ContactEntity.kt` with all contact fields
    - Create `data/local/entity/SettingsEntity.kt` with all settings fields
    - Create `data/local/entity/SyncMetadataEntity.kt` with highWaterMark, lastSyncTimestamp, syncStatus
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.2 Create Room DAOs
    - Create `data/local/dao/ChitDao.kt` with upsertAll, getTaskChits (status not null, not deleted/archived), getNoteChits (note not null, no status/dates), getCalendarChits (has start/end datetime), getChitsForDay
    - Create `data/local/dao/ContactDao.kt` with upsertAll and getAllContacts
    - Create `data/local/dao/SettingsDao.kt` with upsert and getSettings
    - Create `data/local/dao/SyncMetadataDao.kt` with upsert, getMetadata, updateHighWaterMark, updateSyncStatus
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2, 10.4, 11.1, 11.4, 12.1, 12.7_

  - [x] 3.3 Create Room database and type converters
    - Create `data/local/converter/Converters.kt` with Gson-based TypeConverters for `List<String>` ↔ JSON
    - Create `data/local/CwocDatabase.kt` as `@Database` class with all entities and DAOs
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 3.4 Write unit tests for Room DAOs
    - Test chit filtering queries (tasks, notes, calendar)
    - Test upsert behavior (insert + update)
    - Test type converter round-trips
    - _Requirements: 6.1, 10.1, 10.2, 10.4, 11.1, 11.4, 12.1, 12.7_

- [x] 4. Networking layer (Retrofit + OkHttp)
  - [x] 4.1 Create DTOs for API communication
    - Create `data/remote/dto/AuthDto.kt` with DeviceTokenRequest and DeviceTokenResponse
    - Create `data/remote/dto/ChitDto.kt` with all server chit fields (snake_case)
    - Create `data/remote/dto/ContactDto.kt` with all server contact fields
    - Create `data/remote/dto/SettingsDto.kt` with all server settings fields
    - Create `data/remote/dto/SyncResponseDto.kt` with server_version, chits, contacts, settings
    - _Requirements: 4.2, 7.1_

  - [x] 4.2 Create Retrofit API service interface
    - Create `data/remote/CwocApiService.kt` with `authenticate()` (POST /api/auth/device-token) and `getSyncChanges()` (GET /api/sync/changes)
    - _Requirements: 4.2, 7.1, 8.1_

  - [x] 4.3 Create AuthInterceptor and token handling
    - Create `data/remote/AuthInterceptor.kt` — OkHttp Interceptor that adds `Authorization: Bearer <token>` header to all requests except the login endpoint
    - Create `data/remote/TokenAuthenticator.kt` — OkHttp Authenticator that clears the token and emits a revocation event on 401 responses
    - _Requirements: 4.7, 5.1, 5.2_

- [x] 5. Dependency injection (Hilt modules)
  - [x] 5.1 Create Hilt DI modules
    - Create `di/AppModule.kt` providing EncryptedSharedPreferences, CwocDatabase, and all DAOs as singletons
    - Create `di/NetworkModule.kt` providing AuthInterceptor, OkHttpClient, Retrofit (with dynamic base URL from prefs), and CwocApiService
    - _Requirements: 1.4, 4.3, 4.7_

- [x] 6. Checkpoint — Verify data layer compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Repositories
  - [x] 7.1 Create AuthRepository
    - Create `data/repository/AuthRepository.kt` with login(), isAuthenticated(), clearToken(), getLastServerUrl(), and authEvents SharedFlow for token revocation
    - Store token in EncryptedSharedPreferences, persist server URL
    - _Requirements: 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3_

  - [x] 7.2 Create ChitRepository and SyncRepository
    - Create `data/repository/ChitRepository.kt` exposing Flow-based queries from ChitDao
    - Create `data/repository/ContactRepository.kt` exposing contact queries
    - Create `data/repository/SyncRepository.kt` with performInitialSync() and performIncrementalSync() delegating to SyncEngine
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3_

- [x] 8. Sync engine
  - [x] 8.1 Create SyncEngine
    - Create `data/sync/SyncEngine.kt` with `performSync(since: Int): SyncResult`
    - Implement full sync flow: call API → map DTOs to entities → upsert into Room → update high-water mark
    - Handle network errors gracefully, return SyncResult sealed class
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3_

  - [x] 8.2 Create DTO-to-Entity mappers
    - Add `toEntity()` extension functions on ChitDto, ContactDto, SettingsDto
    - Serialize complex JSON fields (checklist, alerts, recurrenceRule) back to JSON strings using Gson
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 8.3 Create SyncWorker for periodic background sync
    - Create `data/sync/SyncWorker.kt` as a Hilt-injected CoroutineWorker
    - Configure WorkManager to run every 5 minutes with network connectivity constraint
    - On 401 response, return Result.failure() (triggers token revocation flow)
    - _Requirements: 8.1, 8.4_

  - [ ]* 8.4 Write unit tests for SyncEngine
    - Test successful sync updates high-water mark
    - Test network error returns SyncResult.NetworkError
    - Test 401 response returns SyncResult.Error with code 401
    - _Requirements: 7.5, 8.2, 8.3, 8.4_

- [x] 9. Checkpoint — Verify sync layer compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Navigation and screen structure
  - [x] 10.1 Create navigation graph and route definitions
    - Create `ui/navigation/Screen.kt` with sealed class defining all routes (Login, Tasks, Notes, Calendar, Checklists, Alarms, Projects)
    - Create `ui/navigation/CwocNavGraph.kt` with NavHost routing to all screens, start destination based on auth state
    - _Requirements: 1.7, 4.4, 5.2, 9.2_

  - [x] 10.2 Create bottom navigation bar
    - Create `ui/navigation/BottomNavBar.kt` with six tabs: Calendar, Checklists, Alarms, Projects, Tasks, Notes
    - Highlight active tab, navigate on tap, use Material 3 NavigationBar
    - Wire into MainActivity scaffold with conditional visibility (hidden on login screen)
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 11. Login screen
  - [x] 11.1 Create LoginViewModel and LoginScreen
    - Create `ui/screens/login/LoginViewModel.kt` with server URL validation, credential submission, error state management
    - Create `ui/screens/login/LoginScreen.kt` with server URL field, username, password, login button, error display
    - Pre-populate server URL from last successful login
    - Trigger initial sync on successful login, then navigate to Tasks
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.4, 4.5, 4.6, 7.6_

- [x] 12. Tasks screen
  - [x] 12.1 Create TasksViewModel and TasksScreen
    - Create `ui/screens/tasks/TasksViewModel.kt` collecting Flow from ChitDao.getTaskChits()
    - Create `ui/screens/tasks/TasksScreen.kt` displaying tasks grouped by status (ToDo, In Progress, Blocked, Complete)
    - Show title, priority indicator, and due date on each task card
    - Show skeleton UI while loading, empty state when no tasks
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 13. Notes screen
  - [x] 13.1 Create NotesViewModel and NotesScreen
    - Create `ui/screens/notes/NotesViewModel.kt` collecting Flow from ChitDao.getNoteChits()
    - Create `ui/screens/notes/NotesScreen.kt` displaying note cards with title and markdown preview
    - _Requirements: 11.1, 11.3, 11.4, 11.5_

  - [x] 13.2 Create markdown renderer utility
    - Create `ui/util/MarkdownRenderer.kt` — a Compose-compatible markdown renderer supporting headings, bold, italic, lists, and code blocks
    - _Requirements: 11.2_

- [x] 14. Calendar screen
  - [x] 14.1 Create CalendarViewModel and CalendarScreen
    - Create `ui/screens/calendar/CalendarViewModel.kt` with day/week view mode, date navigation, event loading from ChitDao
    - Create `ui/screens/calendar/CalendarScreen.kt` with day/week toggle, date navigation header, event list
    - Display event title, time range, and color; distinguish all-day events from timed events
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [x] 15. Placeholder screens and utility components
  - [x] 15.1 Create placeholder and shared UI components
    - Create `ui/screens/placeholder/PlaceholderScreen.kt` showing "Coming Soon" for Checklists, Alarms, and Projects tabs
    - Create `ui/util/DateUtils.kt` with date formatting helpers
    - Create skeleton UI composables for loading states
    - Create `res/values/strings.xml` with app strings
    - _Requirements: 9.4, 9.5, 9.6, 13.1, 13.2, 13.3, 13.4_

- [x] 16. Checkpoint — Verify full app compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Wire everything together
  - [x] 17.1 Wire MainActivity with auth state and navigation
    - Update `MainActivity.kt` to observe auth state from AuthRepository
    - Show/hide bottom nav based on current route (hidden on login)
    - Listen for AuthEvent.TokenRevoked and navigate to login with "Session expired" message
    - Enqueue SyncWorker periodic sync after successful login
    - _Requirements: 4.4, 5.1, 5.2, 5.3, 8.1_

  - [x] 17.2 Wire token revocation flow end-to-end
    - Connect TokenAuthenticator's onTokenRevoked callback to AuthRepository.emitTokenRevoked()
    - Ensure 401 on any API call clears token → emits event → navigates to login with message
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 17.3 Write integration tests for auth flow
    - Test login success navigates to main screen
    - Test login failure shows error message
    - Test 401 response triggers logout flow
    - _Requirements: 4.4, 4.5, 4.6, 5.1, 5.2, 5.3_

- [x] 18. Final checkpoint — Ensure all code compiles and is wired
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design has no Correctness Properties section, so no property-based tests are included
- All code targets Kotlin with Jetpack Compose — no pseudocode translation needed
- No software installations required — all dependencies are declared in build.gradle.kts files
- Lora font files will need to be sourced (Google Fonts) and placed in `res/font/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2", "4.3"] },
    { "id": 4, "tasks": ["3.4", "5.1"] },
    { "id": 5, "tasks": ["7.1", "7.2"] },
    { "id": 6, "tasks": ["8.1", "8.2"] },
    { "id": 7, "tasks": ["8.3", "8.4"] },
    { "id": 8, "tasks": ["10.1", "10.2"] },
    { "id": 9, "tasks": ["11.1", "12.1", "13.1", "13.2", "14.1", "15.1"] },
    { "id": 10, "tasks": ["17.1", "17.2"] },
    { "id": 11, "tasks": ["17.3"] }
  ]
}
```
