# Implementation Plan: Android Phase 2 — Offline CRUD + Live Sync

## Overview

This plan implements full offline create/edit/delete with optimistic push, dirty tracking, WebSocket-based live sync, and connectivity-aware background sync. It builds on the existing Phase 1 architecture (Room, Retrofit, Hilt, Compose) and adds new components incrementally, wiring them together at the end.

## Tasks

- [x] 1. Database migration and entity updates
  - [x] 1.1 Add dirty tracking columns to ChitEntity and create Room migration
    - Add `isDirty: Boolean = false` and `dirtyFields: String? = "[]"` columns to `ChitEntity.kt`
    - Create `Migration1To2.kt` in `data/local/migration/` with ALTER TABLE statements
    - Update `CwocDatabase.kt` to version 2 and register the migration
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3_

  - [x] 1.2 Extend ChitDao with dirty tracking and CRUD queries
    - Add `getDirtyChits()`, `getDirtyCount()`, `updateDirtyState()` queries
    - Add `upsert()` (INSERT with REPLACE), `markDeleted()` queries
    - Add `updateSyncVersion()` query
    - _Requirements: 5.1, 5.2, 4.1_

- [x] 2. Data layer — DTOs, mappers, and API extension
  - [x] 2.1 Create push request/response DTOs
    - Create `SyncPushRequestDto.kt` and `SyncPushResponseDto.kt` in `data/remote/dto/`
    - Include `ChitPushDto`, `SyncPushResponseDto`, `PushResultsDto`, `ChitPushResultDto`
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 2.2 Create Entity↔FormState and Entity→PushDto mappers
    - Create `ChitMapper.kt` in `data/mapper/`
    - Implement `ChitEntity.toFormState()`, `ChitFormState.toEntity()`, `ChitEntity.toPushDto()`
    - Implement `detectChangedFields(original, form)` for dirty field detection
    - _Requirements: 1.1, 1.4, 7.2, 13.1, 13.2_

  - [x] 2.3 Add pushChanges endpoint to CwocApiService
    - Add `@POST("/api/sync/push") suspend fun pushChanges(request): Response<SyncPushResponseDto>`
    - _Requirements: 7.1, 13.3_

  - [x] 2.4 Write property tests for Entity↔FormState round-trip and Entity→PushDto mapping
    - **Property 1: Entity-to-FormState round-trip**
    - **Property 11: Entity-to-PushDto mapping completeness**
    - **Validates: Requirements 1.1, 1.4, 7.2, 13.1, 13.2**

- [x] 3. Dirty tracking system
  - [x] 3.1 Implement DirtyTracker interface and DirtyTrackerImpl
    - Create `DirtyTracker.kt` in `data/sync/` with interface and implementation
    - Implement `markDirty(chitId, changedFields)` with set-union semantics (no duplicates)
    - Implement `clearDirty(chitId)` and `clearDirtyWithMerge(chitId, mergedEntity)`
    - _Requirements: 3.1, 3.2, 5.3, 5.4, 5.5_

  - [x] 3.2 Write property tests for dirty field tracking
    - **Property 5: Dirty fields set semantics — no duplicates**
    - **Property 6: Local write sets isDirty**
    - **Validates: Requirements 3.1, 3.2, 4.2**

- [x] 4. Connectivity monitoring
  - [x] 4.1 Implement ConnectivityMonitor interface and ConnectivityMonitorImpl
    - Create `ConnectivityMonitor.kt` in `data/sync/`
    - Register NetworkCallback with ConnectivityManager
    - Expose `isOnline: StateFlow<Boolean>` and `events: Flow<ConnectivityEvent>`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 5. Sync push engine
  - [x] 5.1 Implement SyncPushEngine interface and SyncPushEngineImpl
    - Create `SyncPushEngine.kt` in `data/sync/`
    - Implement `pushSingle(chitId)` and `pushAll()` methods
    - Handle server response statuses: accepted, created, merged, error
    - Update dirty state and syncVersion based on response
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.2 Write property tests for push response handling
    - **Property 7: Successful push clears dirty state**
    - **Property 8: Merged push updates local entity**
    - **Property 9: Failed push preserves dirty state**
    - **Validates: Requirements 5.3, 5.4, 5.5, 7.3, 7.4, 7.5, 7.6, 7.7**

- [x] 6. Checkpoint — Core data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. WebSocket client
  - [x] 7.1 Implement WebSocketClient interface and WebSocketClientImpl
    - Create `WebSocketClient.kt` in `data/sync/`
    - Use OkHttp WebSocketListener for `/ws/sync` connection
    - Implement exponential backoff reconnect (2s, 4s, 8s... up to 60s)
    - Trigger incremental pull on received change notifications
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. WorkManager push-on-reconnect
  - [x] 8.1 Implement PushSyncWorker
    - Create `PushSyncWorker.kt` in `data/sync/`
    - Push all dirty records via SyncPushEngine.pushAll()
    - Follow with incremental pull via existing SyncEngine
    - Return retry with exponential backoff on transient failures
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9. Sync state management and orchestration
  - [x] 9.1 Implement SyncStateManager
    - Create `SyncStateManager.kt` in `data/sync/`
    - Combine connectivity, WebSocket, and syncing state into `StateFlow<SyncState>`
    - Expose `setSyncing()` and `setIdle()` for push engine to call
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 9.2 Implement SyncOrchestrator
    - Create `SyncOrchestrator.kt` in `data/sync/`
    - Listen to ConnectivityMonitor events
    - On Online: enqueue PushSyncWorker, connect WebSocket after worker completes
    - On Offline: disconnect WebSocket gracefully
    - _Requirements: 8.1, 9.4, 9.5, 10.2, 10.3_

- [x] 10. Dependency injection — SyncModule
  - [x] 10.1 Create SyncModule Hilt module
    - Create `SyncModule.kt` in `di/`
    - Provide all new singletons: ConnectivityMonitor, DirtyTracker, SyncStateManager, WebSocketClient, SyncPushEngine, SyncOrchestrator
    - _Requirements: all (infrastructure wiring)_

- [x] 11. Checkpoint — Sync infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Chit Editor screen
  - [x] 12.1 Create ChitFormState data class
    - Define in `data/mapper/ChitMapper.kt` or a dedicated file
    - Include all editable fields with defaults
    - _Requirements: 1.2, 1.3_

  - [x] 12.2 Implement ChitEditorViewModel
    - Create `ChitEditorViewModel.kt` in `ui/screens/editor/`
    - Load existing chit or initialize empty form for new chit
    - Implement `save()`: persist to Room, mark dirty, optimistic push if online
    - Implement `discard()`: navigate back without DB writes
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 12.3 Create ChitEditorScreen Compose UI
    - Create `ChitEditorScreen.kt` in `ui/screens/editor/`
    - Editable controls for all fields: title, note, dates, status, priority, tags, checklist, people, location, color, alerts, recurrence, all-day, timezone, availability
    - Save and discard actions in top bar
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 12.4 Write property tests for editor save/create flows
    - **Property 3: New chit creation invariants**
    - **Property 4: Dirty fields completeness on creation**
    - **Validates: Requirements 2.2, 2.3**

- [x] 13. UI components — FAB, swipe-to-delete, sync indicator
  - [x] 13.1 Create SyncStateIndicator composable
    - Create `SyncStateIndicator.kt` in `ui/components/`
    - Green/orange/red dot based on SyncState
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 13.2 Create SwipeableChitCard composable
    - Create `SwipeableChitCard.kt` in `ui/components/`
    - End-to-start swipe with red delete background
    - _Requirements: 4.1_

  - [x] 13.3 Create ChitListScaffold with FAB and sync indicator
    - Create `ChitListScaffold.kt` in `ui/components/`
    - Shared scaffold for Tasks, Notes, Calendar with FAB → Editor navigation
    - Include SyncStateIndicator in TopAppBar
    - _Requirements: 2.1, 11.1_

- [x] 14. Update existing screens — Tasks, Notes, Calendar
  - [x] 14.1 Update TasksScreen and TasksViewModel with FAB, swipe, and click-to-edit
    - Integrate ChitListScaffold (FAB + sync indicator)
    - Wrap chit cards with SwipeableChitCard
    - Add `softDelete()` to TasksViewModel
    - Navigate to Editor on card click
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 12.1, 12.2_

  - [x] 14.2 Update NotesScreen and NotesViewModel with FAB, swipe, and click-to-edit
    - Same pattern as Tasks: ChitListScaffold, SwipeableChitCard, softDelete, click-to-edit
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 12.1_

  - [x] 14.3 Update navigation graph with Editor route
    - Add `Screen.Editor` sealed class entry with `chitId` argument
    - Add composable route in `CwocNavGraph.kt`
    - _Requirements: 2.1, 1.1_

  - [x] 14.4 Write unit tests for soft-delete and view reactivity
    - **Property 13: Soft-deleted chits excluded from active views**
    - **Validates: Requirements 4.4, 12.4**

- [x] 15. Integration wiring and app startup
  - [x] 15.1 Initialize SyncOrchestrator at app startup
    - Call `syncOrchestrator.start()` in Application class or main Activity
    - Ensure WebSocket connects on launch when online
    - Ensure PushSyncWorker flushes any dirty records from previous session
    - _Requirements: 8.1, 9.1, 9.4, 10.2_

  - [x] 15.2 Ensure Room reactive queries update all views on local writes
    - Verify Tasks, Notes, Calendar screens use `Flow` queries from ChitDao
    - Confirm soft-delete, status change, and date change trigger automatic UI updates
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 16. Final checkpoint — All features integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses Kotlin — all implementation tasks target Kotlin/Jetpack Compose
- All code lives under `/android/app/src/main/java/com/cwoc/app/`
- No software installation required — only code writing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["2.4", "3.2", "4.1"] },
    { "id": 4, "tasks": ["5.1", "12.1"] },
    { "id": 5, "tasks": ["5.2", "7.1", "8.1"] },
    { "id": 6, "tasks": ["9.1", "9.2"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["12.2", "13.1", "13.2", "13.3"] },
    { "id": 9, "tasks": ["12.3", "12.4"] },
    { "id": 10, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 11, "tasks": ["14.4", "15.1", "15.2"] }
  ]
}
```
