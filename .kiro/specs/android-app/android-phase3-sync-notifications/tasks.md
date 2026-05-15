# Implementation Plan: Android Phase 3 — Full Bidirectional Sync + Notifications

## Overview

This plan implements Phase 3 of the CWOC Android app, building on the Phase 2 architecture. It covers: Room DB migration v2→v3, conflict banner UI, contacts CRUD with push sync, settings sync, attachment management (lazy download/eager upload/cache), local notifications via AlarmManager, notification channels, BOOT_COMPLETED receiver, and edge case handling (delete-vs-edit, checklist LWW, tag renames). All code is Kotlin at `/android/`.

## Tasks

- [ ] 1. Database migration and new entities
  - [ ] 1.1 Create ContactEntity, SettingsEntity, and AttachmentMetadata Room entities
    - Define `ContactEntity` data class with all columns (id, name, email, phone, address, notes, tags, imageUrl, sync metadata)
    - Define `SettingsEntity` data class (id, settingsJson, syncVersion, isDirty, lastModified)
    - Define `AttachmentMetadata` data class (id, chitId, url, filename, sizeBytes, mimeType, localPath, pendingUpload, lastAccessedAt, createdAt)
    - Add TypeConverters for List<String> serialization if not already present
    - _Requirements: 3.1, 6.1, 8.1, 17.1, 17.2_

  - [ ] 1.2 Create ContactDao, SettingsDao, and AttachmentMetadataDao
    - Implement `ContactDao` with getAllActive(), search(), getById(), getDirtyContacts(), upsert(), upsertAll(), markDeleted(), updateDirtyState(), updateSyncVersion(), setConflictState()
    - Implement `SettingsDao` with get(), update(), clearDirty(), updateSyncVersion(), replace()
    - Implement `AttachmentMetadataDao` with insert(), getByUrl(), getByChitId(), getPendingUploads(), getAllCachedSortedByAccess(), updateLocalPath(), updateLastAccessed(), updateAfterUpload(), clearLocalPath()
    - _Requirements: 3.2, 3.3, 6.1, 8.1, 10.3_

  - [ ] 1.3 Implement MIGRATION_2_3 and update CwocDatabase to version 3
    - Write Migration(2, 3) creating contacts table, settings table, attachment_metadata table
    - Add `ALTER TABLE chits ADD COLUMN conflictFields TEXT DEFAULT NULL`
    - Update `@Database` annotation to version 3, add new entities and DAOs
    - Register MIGRATION_2_3 in the database builder
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [ ]* 1.4 Write unit tests for database migration
    - Test migration preserves existing chit data
    - Test new tables are created with correct schema
    - Test conflictFields column added to chits
    - _Requirements: 17.4_

- [ ] 2. Checkpoint — Ensure database compiles and migration is correct
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Conflict banner and conflict state handling
  - [ ] 3.1 Add conflictFields column to ChitEntity and extend ChitDao
    - Add `conflictFields: String?` field to existing ChitEntity
    - Add `clearConflictFlag(id)` and `setConflictState(id, fields)` queries to ChitDao
    - _Requirements: 1.4, 2.2, 2.3_

  - [ ] 3.2 Implement ConflictBanner composable
    - Create `ConflictBanner` Compose component with error-container styling
    - Display "⚠️ Sync conflict resolved — View in audit log" text
    - Include dismiss IconButton (close icon)
    - _Requirements: 1.1, 1.2_

  - [ ] 3.3 Extend ChitEditorViewModel with conflict dismiss logic
    - Add `showConflictBanner` and `conflictFields` StateFlows
    - Load conflict state from entity on editor open
    - Implement `dismissConflict()` — clear local flag, call `POST /api/chit/{id}/dismiss-conflict`, queue for sync on failure
    - Add `dismissConflict` endpoint to CwocApiService interface
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 3.4 Write unit tests for conflict dismiss flow
    - Test banner shows when hasUnviewedConflict is true
    - Test dismiss clears local state and calls API
    - Test network failure queues dismiss for later
    - _Requirements: 1.3, 1.4, 1.5_

- [ ] 4. Contacts CRUD and sync
  - [ ] 4.1 Implement ContactRepository
    - Create `ContactRepositoryImpl` exposing `allContacts: Flow`, `searchContacts()`, `getById()`, `create()`, `update()`, `delete()`
    - Wire dirty tracking on create/edit/delete
    - Trigger immediate push when online
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 4.2 Implement ContactEditorViewModel
    - Create ViewModel with `ContactFormState`, load/save/delete logic
    - Implement `detectContactChangedFields()` for field-level dirty tracking
    - Wire `DirtyTracker.markContactDirty()` on save
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 4.3 Extend DirtyTracker for contacts and settings
    - Add `markContactDirty(contactId, changedFields)` and `clearContactDirty(contactId)`
    - Add `markSettingsDirty()` and `clearSettingsDirty()`
    - _Requirements: 4.2, 5.2, 6.3_

  - [ ]* 4.4 Write unit tests for ContactRepository and dirty tracking
    - Test create sets isDirty and generates UUID
    - Test edit records changed fields
    - Test delete marks deleted=true and isDirty=true
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Settings sync
  - [ ] 5.1 Implement SettingsRepository
    - Create `SettingsRepositoryImpl` with `settings: Flow`, `get()`, `update()`, `replaceWithServerVersion()`, `clearDirty()`
    - Mark dirty on local update, trigger push when online
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 5.2 Implement settings conflict resolution (LWW)
    - On "merged" response, replace local settings entirely with server version
    - Apply new settings values to running app state immediately
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 5.3 Write unit tests for SettingsRepository
    - Test update marks dirty
    - Test replaceWithServerVersion overwrites local
    - Test clearDirty resets isDirty
    - _Requirements: 6.3, 6.5, 7.1_

- [ ] 6. Extended push sync engine
  - [ ] 6.1 Extend SyncPushEngine to include contacts and settings
    - Modify `pushAll()` to gather dirty contacts and dirty settings alongside chits
    - Build `SyncPushRequestDto` with optional `contacts` and `settings` fields
    - Process `ContactPushResultDto` and `SettingsPushResultDto` from response
    - Handle "accepted", "created", "merged", "error" statuses for contacts
    - Handle "accepted", "merged" statuses for settings
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.4, 6.5, 18.1, 18.2, 18.3, 18.4, 18.5_

  - [ ] 6.2 Create push/pull DTOs for contacts and settings
    - Define `ContactPushDto`, `SettingsPushDto`, `SyncPushRequestDto` (extended)
    - Define `ContactPushResultDto`, `SettingsPushResultDto`, `PushResultsDto`
    - Define `SyncPullResponseDto` extensions for contacts, settings, tag_renames
    - _Requirements: 18.3, 5.1_

  - [ ] 6.3 Handle conflict state from push response (chits + contacts)
    - On "merged" chit response: update local entity with merged values, set hasUnviewedConflict=true, store conflictFields, clear dirty
    - On "merged" contact response: same pattern for contacts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.3_

  - [ ]* 6.4 Write unit tests for extended push engine
    - Test contacts included in push request when dirty
    - Test settings included when dirty, omitted when clean
    - Test merged response sets conflict flags
    - _Requirements: 18.4, 18.5, 2.1, 2.4_

- [ ] 7. Checkpoint — Ensure sync compiles and contacts/settings flow works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Attachment management
  - [ ] 8.1 Implement AttachmentCache with LRU eviction
    - Create `AttachmentCacheImpl` with file storage in app cache directory
    - Implement `get()`, `put()`, `evictIfNeeded()`, `remove()`, `getTotalSize()`
    - Enforce configurable max size (100MB default)
    - Evict least-recently-accessed files, never evict pending uploads
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 8.2 Implement AttachmentManager (download + upload + cache orchestration)
    - Implement `downloadAttachment()` — check cache first, download with progress, store in cache
    - Implement `uploadAttachment()` — store locally, upload immediately if online, queue if offline
    - Implement `uploadPendingAttachments()` — called on connectivity restore
    - Implement `getCachedFile()` and `getDownloadState()` StateFlow
    - Add download/upload endpoints to CwocApiService
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 8.3 Write unit tests for AttachmentCache eviction logic
    - Test eviction removes oldest-accessed files first
    - Test pending uploads are never evicted
    - Test metadata retained after eviction
    - _Requirements: 10.2, 10.3, 10.4_

- [ ] 9. Local notifications
  - [ ] 9.1 Implement NotificationChannelManager
    - Create three channels at app startup: "Alarms" (high, sound+vibration), "Reminders" (default, no sound), "Timers" (high, sound+vibration)
    - Call `createChannels()` from Application.onCreate()
    - _Requirements: 12.1_

  - [ ] 9.2 Implement NotificationScheduler
    - Create `NotificationSchedulerImpl` with `scheduleAlarms()`, `cancelAlarms()`, `rescheduleAll()`
    - Parse alert data from ChitEntity JSON
    - Use `setExactAndAllowWhileIdle()` when permission granted, fallback to `set()` otherwise
    - Implement `hasExactAlarmPermission()` check for API 31+
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 13.3_

  - [ ] 9.3 Implement AlarmReceiver BroadcastReceiver
    - Route to correct notification channel based on AlertType
    - Build notification with chit title, appropriate priority, sound/vibration per type
    - Create PendingIntent to open ChitEditor on tap
    - Check POST_NOTIFICATIONS permission before notify
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

  - [ ] 9.4 Implement BootReceiver for alarm re-registration
    - Listen for ACTION_BOOT_COMPLETED
    - Use `goAsync()` + coroutine to call `notificationScheduler.rescheduleAll()`
    - Access scheduler via Hilt EntryPoint
    - _Requirements: 11.5_

  - [ ] 9.5 Update AndroidManifest with permissions and receivers
    - Add SCHEDULE_EXACT_ALARM (maxSdkVersion=32), USE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, POST_NOTIFICATIONS
    - Register AlarmReceiver and BootReceiver with intent-filters
    - _Requirements: 13.1, 13.2, 13.4_

  - [ ]* 9.6 Write unit tests for NotificationScheduler
    - Test alarms scheduled for future times only
    - Test cancelAlarms removes pending intents
    - Test rescheduleAll re-registers all active chit alarms
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 10. Checkpoint — Ensure notifications compile and channels are created
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Edge case handling
  - [ ] 11.1 Implement EdgeCaseHandler (delete-vs-edit, tag rename, checklist LWW)
    - `handleServerDeletion()`: delete wins, clear dirty, log lost edit, cancel alarms
    - `applyTagRename()`: update tags on all affected chits without dirtying
    - `applyChecklistMerge()`: replace local checklist with server version (LWW)
    - _Requirements: 14.1, 14.2, 14.3, 15.1, 15.2, 16.1, 16.2_

  - [ ] 11.2 Implement LostEditLogger
    - Store lost edit entries in SharedPreferences (last 50)
    - Record chitId, title, dirtyFields, timestamp
    - _Requirements: 14.3_

  - [ ] 11.3 Extend SyncEngine pull processing for Phase 3
    - Handle server deletions via EdgeCaseHandler
    - Process contacts and settings from pull response
    - Process tag_renames array from pull response
    - Schedule/reschedule alarms for synced chits with alerts
    - _Requirements: 3.2, 6.2, 14.1, 16.1, 16.3_

  - [ ]* 11.4 Write unit tests for EdgeCaseHandler
    - Test delete-vs-edit: dirty chit gets deleted, edit logged
    - Test tag rename updates all matching chits without dirtying
    - Test checklist LWW replaces local data
    - _Requirements: 14.1, 14.2, 15.1, 16.2_

- [ ] 12. Dependency injection and wiring
  - [ ] 12.1 Create Phase3Module for Hilt DI
    - Provide ContactRepository, SettingsRepository, AttachmentManager, AttachmentCache
    - Provide NotificationScheduler, NotificationChannelManager, EdgeCaseHandler, LostEditLogger
    - Wire new DAOs from CwocDatabase
    - _Requirements: all (infrastructure wiring)_

  - [ ] 12.2 Wire notification channel creation and alarm permission prompt
    - Call `NotificationChannelManager.createChannels()` in Application.onCreate()
    - Add exact alarm permission check + prompt in settings or on first alarm schedule
    - _Requirements: 12.1, 13.2, 13.3_

  - [ ] 12.3 Wire PushSyncWorker to include contacts and settings
    - Extend existing WorkManager worker to call extended `pushAll()`
    - Trigger `uploadPendingAttachments()` on connectivity restore
    - _Requirements: 5.4, 9.4_

- [ ] 13. Final checkpoint — Ensure all components compile and integrate
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- All code is Kotlin targeting API 26+ in the `/android/` directory
- This builds on Phase 2 architecture — DirtyTracker, SyncPushEngine, WebSocketClient, ConnectivityMonitor, WorkManager PushSyncWorker are all extended, not replaced
- The design has no Correctness Properties section, so no property-based tests are included — only unit tests (marked optional)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "4.3"] },
    { "id": 5, "tasks": ["3.4", "4.1", "5.1"] },
    { "id": 6, "tasks": ["4.2", "5.2", "6.2"] },
    { "id": 7, "tasks": ["4.4", "5.3", "6.1"] },
    { "id": 8, "tasks": ["6.3"] },
    { "id": 9, "tasks": ["6.4", "8.1", "9.1"] },
    { "id": 10, "tasks": ["8.2", "9.2"] },
    { "id": 11, "tasks": ["8.3", "9.3", "9.4", "9.5"] },
    { "id": 12, "tasks": ["9.6", "11.1", "11.2"] },
    { "id": 13, "tasks": ["11.3", "11.4"] },
    { "id": 14, "tasks": ["12.1"] },
    { "id": 15, "tasks": ["12.2", "12.3"] }
  ]
}
```
