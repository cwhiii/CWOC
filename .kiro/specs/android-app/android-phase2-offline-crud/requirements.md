# Requirements Document

## Introduction

This document specifies the requirements for Phase 2 of the CWOC Android app: Offline CRUD + Live Sync. Phase 2 builds on the read-only Phase 1 architecture (Room database, Retrofit networking, Hilt DI, Compose UI) and adds full create/edit/delete capabilities that work offline, with optimistic push when online, dirty tracking for offline changes, WebSocket-based live sync, and connectivity-aware background sync via WorkManager.

## Glossary

- **App**: The CWOC Android application (Kotlin, Jetpack Compose)
- **Chit_Editor**: The full-screen Compose UI for creating and editing chit records
- **Dirty_Tracker**: The component responsible for marking locally modified records with `is_dirty = true` and recording changed field names in `dirty_fields`
- **Sync_Push_Engine**: The component that sends dirty local records to the server via `POST /api/sync/push`
- **WebSocket_Client**: The OkHttp WebSocket connection to `/ws/sync` for receiving real-time change notifications
- **Connectivity_Monitor**: The Android ConnectivityManager-based component that observes network state transitions
- **Sync_Worker**: The WorkManager-based background job that flushes the dirty queue on reconnect
- **Sync_State_Indicator**: The UI element in the top app bar showing current sync/connectivity status
- **Room_Database**: The local SQLite database managed by Android Room (version 2 after migration)
- **ChitEntity**: The Room entity representing a chit record in the local database
- **FAB**: Floating Action Button for creating new chits
- **Dirty_Queue**: The ordered set of ChitEntity records where `is_dirty = true`
- **Push_Response**: The per-record status returned by the server after a push operation (accepted, created, merged, error)

## Requirements

### Requirement 1: Chit Editor Screen

**User Story:** As a user, I want a full editor screen for chits so that I can create, view, and modify all chit fields on my Android device.

#### Acceptance Criteria

1. WHEN the user opens the Chit_Editor for an existing chit, THE App SHALL populate all fields with the current local values from the Room_Database.
2. WHEN the user opens the Chit_Editor for a new chit, THE App SHALL display empty or default values for all editable fields.
3. THE Chit_Editor SHALL provide editable controls for: title, note, start datetime, end datetime, due datetime, point in time, status, priority, tags, checklist, people, location, color, alerts, recurrence, all-day flag, timezone, and availability.
4. WHEN the user saves changes in the Chit_Editor, THE App SHALL persist the modified fields to the Room_Database immediately.
5. WHEN the user discards changes in the Chit_Editor, THE App SHALL navigate back without modifying the Room_Database.

### Requirement 2: Chit Creation

**User Story:** As a user, I want to create new chits directly on my device so that I can capture information even when offline.

#### Acceptance Criteria

1. WHEN the user taps the FAB on a chit list screen, THE App SHALL navigate to the Chit_Editor in creation mode.
2. WHEN the user saves a new chit, THE App SHALL generate a UUID locally and store the new ChitEntity in the Room_Database with `is_dirty = true`.
3. WHEN the user saves a new chit, THE Dirty_Tracker SHALL set `dirty_fields` to contain all populated field names on the new record.
4. WHEN a new chit is saved and the device is online, THE Sync_Push_Engine SHALL attempt to push the record to the server immediately in the background.

### Requirement 3: Chit Editing

**User Story:** As a user, I want to edit existing chits so that I can update information as things change.

#### Acceptance Criteria

1. WHEN the user modifies one or more fields and saves, THE Dirty_Tracker SHALL set `is_dirty = true` on the ChitEntity.
2. WHEN the user modifies one or more fields and saves, THE Dirty_Tracker SHALL append the names of changed fields to the `dirty_fields` JSON array without duplicating existing entries.
3. WHEN an edit is saved and the device is online, THE Sync_Push_Engine SHALL attempt to push the record to the server immediately in the background.
4. WHILE the Sync_Push_Engine is pushing a record, THE App SHALL display success to the user optimistically without waiting for the server response.

### Requirement 4: Chit Soft-Delete

**User Story:** As a user, I want to delete chits with a swipe gesture so that I can quickly remove items I no longer need.

#### Acceptance Criteria

1. WHEN the user swipes a chit card in a list view, THE App SHALL mark the ChitEntity as `deleted = true` in the Room_Database.
2. WHEN a chit is soft-deleted, THE Dirty_Tracker SHALL set `is_dirty = true` and add "deleted" to `dirty_fields`.
3. WHEN a chit is soft-deleted and the device is online, THE Sync_Push_Engine SHALL attempt to push the deletion to the server immediately in the background.
4. WHEN a chit is soft-deleted, THE App SHALL remove the chit from all active list views immediately.

### Requirement 5: Dirty Tracking

**User Story:** As a user, I want my offline changes tracked reliably so that nothing is lost when connectivity returns.

#### Acceptance Criteria

1. THE Room_Database SHALL store an `is_dirty` boolean column on ChitEntity indicating whether the record has unpushed local changes.
2. THE Room_Database SHALL store a `dirty_fields` text column on ChitEntity containing a JSON array of field names that have been locally modified since the last successful push.
3. WHEN a push for a record succeeds with status "accepted" or "created", THE Dirty_Tracker SHALL set `is_dirty = false` and clear `dirty_fields` to an empty array.
4. WHEN a push for a record succeeds with status "merged", THE Dirty_Tracker SHALL set `is_dirty = false`, clear `dirty_fields`, and update the local record with the server-merged values.
5. WHEN a push for a record fails with status "error", THE Dirty_Tracker SHALL retain `is_dirty = true` and preserve `dirty_fields` for retry.

### Requirement 6: Database Migration

**User Story:** As a user upgrading from Phase 1, I want my existing local data preserved when the app adds dirty tracking columns.

#### Acceptance Criteria

1. WHEN the App launches with a Room_Database at version 1, THE App SHALL execute a migration to version 2 that adds the `is_dirty` column with a default value of `false`.
2. WHEN the App launches with a Room_Database at version 1, THE App SHALL execute a migration to version 2 that adds the `dirty_fields` column with a default value of an empty JSON array `"[]"`.
3. THE App SHALL preserve all existing ChitEntity data during the migration from version 1 to version 2.

### Requirement 7: Optimistic Push

**User Story:** As a user, I want my changes to sync to the server immediately when online so that other devices see updates quickly.

#### Acceptance Criteria

1. WHILE the device is online, WHEN a local write occurs, THE Sync_Push_Engine SHALL initiate a background push of the dirty record via `POST /api/sync/push` without blocking the UI.
2. WHEN the Sync_Push_Engine pushes a record, THE App SHALL include the `last_known_sync_version` field set to the ChitEntity's current `syncVersion` value.
3. WHEN the server responds with status "accepted" for a pushed record, THE Dirty_Tracker SHALL clear the dirty state and update the local `syncVersion` to the value returned by the server.
4. WHEN the server responds with status "created" for a pushed record, THE Dirty_Tracker SHALL clear the dirty state and update the local `syncVersion` to the value returned by the server.
5. WHEN the server responds with status "merged" for a pushed record, THE App SHALL update the local ChitEntity with the server's merged version, clear the dirty state, and update the local `syncVersion`.
6. WHEN the server responds with status "error" for a pushed record, THE Dirty_Tracker SHALL retain the dirty state for later retry.
7. IF the push network request fails due to connectivity loss, THEN THE Sync_Push_Engine SHALL retain the dirty state and rely on the Sync_Worker to retry on reconnect.

### Requirement 8: Sync Push via WorkManager

**User Story:** As a user, I want my offline changes automatically pushed when connectivity returns so that I do not have to manually trigger sync.

#### Acceptance Criteria

1. WHEN the Connectivity_Monitor detects a transition from offline to online, THE Sync_Worker SHALL enqueue a one-time expedited WorkManager job to flush all dirty records.
2. WHEN the Sync_Worker executes, THE Sync_Push_Engine SHALL push all records in the Dirty_Queue via a single `POST /api/sync/push` request containing all dirty chits.
3. WHEN the push completes successfully, THE Sync_Worker SHALL trigger an incremental pull via `GET /api/sync/changes?since={highWaterMark}` to fetch any missed server changes.
4. IF the Sync_Worker push fails due to a transient network error, THEN THE Sync_Worker SHALL return a retry result with exponential backoff.
5. WHEN the Sync_Worker completes all push and pull operations successfully, THE App SHALL update the high-water mark in SyncMetadataEntity.

### Requirement 9: WebSocket Live Sync

**User Story:** As a user, I want real-time updates from the server so that changes made on other devices appear on my phone immediately.

#### Acceptance Criteria

1. WHILE the device is online, THE WebSocket_Client SHALL maintain a connection to `/ws/sync`.
2. WHEN the WebSocket_Client receives a change notification, THE App SHALL perform an incremental pull via `GET /api/sync/changes?since={highWaterMark}` and upsert the results into the Room_Database.
3. IF the WebSocket connection drops unexpectedly, THEN THE WebSocket_Client SHALL attempt to reconnect with exponential backoff.
4. WHEN the Connectivity_Monitor detects a transition from offline to online, THE WebSocket_Client SHALL establish a new connection to `/ws/sync` after the Sync_Worker completes its flush.
5. WHEN the Connectivity_Monitor detects a transition from online to offline, THE WebSocket_Client SHALL close the connection gracefully.

### Requirement 10: Connectivity Monitoring

**User Story:** As a user, I want the app to automatically detect network changes so that sync behavior adapts without manual intervention.

#### Acceptance Criteria

1. THE Connectivity_Monitor SHALL register a NetworkCallback with Android ConnectivityManager to observe network availability changes.
2. WHEN the network becomes available, THE Connectivity_Monitor SHALL emit an online event to the Sync_Worker and WebSocket_Client.
3. WHEN the network becomes unavailable, THE Connectivity_Monitor SHALL emit an offline event to the WebSocket_Client.
4. THE Connectivity_Monitor SHALL expose the current connectivity state as an observable Flow for UI consumption.

### Requirement 11: Sync State Indicator

**User Story:** As a user, I want a subtle visual indicator of my sync status so that I know whether my data is up to date.

#### Acceptance Criteria

1. THE Sync_State_Indicator SHALL display a green dot icon in the top app bar when the device is online and the WebSocket connection is active.
2. THE Sync_State_Indicator SHALL display an orange dot icon in the top app bar when the Sync_Push_Engine or Sync_Worker is actively pushing or pulling data.
3. THE Sync_State_Indicator SHALL display a red dot icon in the top app bar when the device is offline.
4. WHEN the sync state changes, THE Sync_State_Indicator SHALL update within 1 second of the state transition.

### Requirement 12: Existing Views React to Local Edits

**User Story:** As a user, I want my Tasks, Notes, and Calendar views to immediately reflect local edits so that the UI stays consistent with my changes.

#### Acceptance Criteria

1. WHEN a ChitEntity is created, modified, or soft-deleted in the Room_Database, THE App SHALL automatically update all active list views (Tasks, Notes, Calendar) via Room's reactive Flow queries.
2. WHEN a chit's status field changes, THE Tasks view SHALL re-sort or re-group the chit according to the updated status.
3. WHEN a chit's date fields change, THE Calendar view SHALL display the chit on the correct date.
4. WHEN a chit is soft-deleted, THE App SHALL remove the chit from all active views without requiring a manual refresh.

### Requirement 13: Push Request Format

**User Story:** As a developer, I want the push request to include version information so that the server can detect and resolve conflicts.

#### Acceptance Criteria

1. WHEN the Sync_Push_Engine constructs a push request, THE App SHALL include all fields of each dirty ChitEntity in the request body.
2. WHEN the Sync_Push_Engine constructs a push request, THE App SHALL set `last_known_sync_version` on each chit to the value of the ChitEntity's `syncVersion` column.
3. THE Sync_Push_Engine SHALL format the push request body as `{"chits": [...]}` matching the server's expected `POST /api/sync/push` schema.
