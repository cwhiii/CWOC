# Requirements Document

## Introduction

This document specifies the requirements for Phase 3 of the CWOC Android app: Full Bidirectional Sync + Notifications. Phase 3 builds on the Phase 2 architecture (offline CRUD, dirty tracking, push/pull sync, WebSocket live sync, WorkManager) and adds client-side conflict handling UI, contacts CRUD with push sync, settings push sync, attachment sync (lazy download, eager upload), local notifications via AlarmManager exact alarms, and edge case handling for delete-vs-edit conflicts, checklist reorder conflicts, settings conflicts, and tag renames.

## Glossary

- **App**: The CWOC Android application (Kotlin, Jetpack Compose)
- **Conflict_Banner**: A dismissible UI element displayed in the Chit_Editor when a sync conflict was resolved on the server for that chit
- **Conflict_Field**: A field name returned by the server in `conflict_fields` when a push results in a "merged" status, indicating that field had competing edits
- **Contact_Entity**: The Room entity representing a contact record in the local database, mirroring the server contacts table
- **Contact_Repository**: The data layer component managing local contact CRUD and sync operations
- **Settings_Entity**: The Room entity representing the user settings record in the local database
- **Settings_Repository**: The data layer component managing local settings persistence and sync
- **Attachment_Cache**: The local file storage for downloaded attachment files, managed with size limits
- **Attachment_Manager**: The component responsible for lazy downloading and eager uploading of chit attachments
- **Notification_Scheduler**: The component that schedules and cancels local notifications using AlarmManager exact alarms
- **Notification_Channel**: An Android NotificationChannel configured for CWOC alert types (alarms, reminders, timers)
- **Alarm_Receiver**: A BroadcastReceiver that fires when an AlarmManager alarm triggers, creating the notification
- **Chit_Editor**: The full-screen Compose UI for creating and editing chit records
- **Dirty_Tracker**: The component responsible for marking locally modified records with `is_dirty = true` and recording changed field names
- **Sync_Push_Engine**: The component that sends dirty local records to the server via `POST /api/sync/push`
- **Room_Database**: The local SQLite database managed by Android Room (version 3 after Phase 3 migration)
- **ChitEntity**: The Room entity representing a chit record in the local database
- **Sync_Worker**: The WorkManager-based background job that flushes the dirty queue on reconnect
- **Connectivity_Monitor**: The Android ConnectivityManager-based component that observes network state transitions
- **Audit_Log**: The server-side record of conflict resolutions accessible via the web app

## Requirements

### Requirement 1: Conflict Banner Display

**User Story:** As a user, I want to see when a sync conflict was resolved on one of my chits so that I am aware my edits were merged with changes from another device.

#### Acceptance Criteria

1. WHEN the user opens the Chit_Editor for a ChitEntity where `has_unviewed_conflict` is `true`, THE App SHALL display a Conflict_Banner at the top of the editor screen.
2. THE Conflict_Banner SHALL display the text "⚠️ Sync conflict resolved — View in audit log" to inform the user that a merge occurred.
3. WHEN the user taps the dismiss action on the Conflict_Banner, THE App SHALL call `POST /api/chit/{id}/dismiss-conflict` to clear the flag on the server.
4. WHEN the dismiss API call succeeds, THE App SHALL set `has_unviewed_conflict` to `false` on the local ChitEntity and hide the Conflict_Banner.
5. IF the dismiss API call fails due to network unavailability, THEN THE App SHALL hide the Conflict_Banner locally and queue the dismiss call for the next sync cycle.

### Requirement 2: Conflict State from Push Response

**User Story:** As a user, I want conflict information from the server to be stored locally so that I see the conflict banner the next time I open the affected chit.

#### Acceptance Criteria

1. WHEN the Sync_Push_Engine receives a push response with status "merged" for a chit, THE App SHALL update the local ChitEntity with the server's merged field values.
2. WHEN the Sync_Push_Engine receives a push response with status "merged" for a chit, THE App SHALL set `has_unviewed_conflict` to `true` on the local ChitEntity.
3. WHEN the Sync_Push_Engine receives a push response with status "merged" containing `conflict_fields`, THE App SHALL store the list of conflicted field names in the local ChitEntity for display purposes.
4. WHEN the Sync_Push_Engine receives a push response with status "merged", THE Dirty_Tracker SHALL clear `is_dirty` and `dirty_fields` on the affected record since the server has resolved the conflict.

### Requirement 3: Contacts Local Storage

**User Story:** As a user, I want my contacts stored locally on my device so that I can view and reference them while offline.

#### Acceptance Criteria

1. THE Room_Database SHALL include a Contact_Entity table with columns mirroring the server contacts schema: id, name, email, phone, address, notes, tags, image_url, and sync metadata fields (sync_version, is_dirty, dirty_fields).
2. WHEN the App performs a sync pull that includes contacts, THE Contact_Repository SHALL upsert all received contact records into the local Contact_Entity table.
3. THE Contact_Repository SHALL expose reactive Flow queries for listing, searching, and retrieving individual contacts from the Room_Database.

### Requirement 4: Contacts CRUD

**User Story:** As a user, I want to create, edit, and delete contacts on my device so that I can manage my contact list while offline.

#### Acceptance Criteria

1. WHEN the user creates a new contact, THE App SHALL generate a UUID locally and store the new Contact_Entity in the Room_Database with `is_dirty = true`.
2. WHEN the user edits a contact and saves, THE Dirty_Tracker SHALL set `is_dirty = true` on the Contact_Entity and record the changed field names in `dirty_fields`.
3. WHEN the user deletes a contact, THE App SHALL mark the Contact_Entity as `deleted = true` in the Room_Database and set `is_dirty = true`.
4. WHEN a contact is created, edited, or deleted while the device is online, THE Sync_Push_Engine SHALL attempt to push the contact change to the server immediately in the background.

### Requirement 5: Contacts Push Sync

**User Story:** As a user, I want my contact changes synced to the server so that other devices see my updates.

#### Acceptance Criteria

1. WHEN the Sync_Push_Engine pushes changes, THE App SHALL include dirty Contact_Entity records in the `contacts` array of the `POST /api/sync/push` request body.
2. WHEN the server responds with status "accepted" or "created" for a pushed contact, THE Dirty_Tracker SHALL clear the dirty state and update the local `sync_version`.
3. WHEN the server responds with status "merged" for a pushed contact, THE App SHALL update the local Contact_Entity with the server's merged values, set `has_unviewed_conflict` to `true`, and clear the dirty state.
4. WHEN the Sync_Worker flushes the dirty queue on reconnect, THE Sync_Push_Engine SHALL include all dirty contacts alongside dirty chits in the push request.
5. WHEN the server responds with status "error" for a pushed contact, THE Dirty_Tracker SHALL retain the dirty state for later retry.

### Requirement 6: Settings Local Storage and Sync

**User Story:** As a user, I want my app settings synced between devices so that preferences I set on one device apply everywhere.

#### Acceptance Criteria

1. THE Room_Database SHALL include a Settings_Entity record storing the user's settings with sync metadata fields (sync_version, is_dirty).
2. WHEN the App performs a sync pull that includes settings, THE Settings_Repository SHALL update the local Settings_Entity with the received values.
3. WHEN the user modifies a setting locally, THE Settings_Repository SHALL update the local Settings_Entity and set `is_dirty = true`.
4. WHEN settings are dirty and the device is online, THE Sync_Push_Engine SHALL include the settings object in the `POST /api/sync/push` request body.
5. WHEN the server responds with status "accepted" for pushed settings, THE Dirty_Tracker SHALL clear the dirty state and update the local `sync_version`.

### Requirement 7: Settings Conflict Resolution

**User Story:** As a user, I want settings conflicts resolved automatically so that I do not lose my preferences.

#### Acceptance Criteria

1. WHEN the server responds with status "merged" for pushed settings, THE App SHALL replace the local Settings_Entity with the server's version entirely (LWW on the whole record).
2. WHEN a settings conflict is resolved by the server, THE App SHALL apply the new settings values to the running app state immediately.
3. THE App SHALL treat settings sync as LWW on the entire record with no field-level merge.

### Requirement 8: Attachment Lazy Download

**User Story:** As a user, I want attachments downloaded only when I need them so that the app does not consume excessive storage or bandwidth.

#### Acceptance Criteria

1. WHEN the App syncs a chit that references attachments, THE App SHALL store the attachment metadata (URL, filename, size) locally without downloading the file content.
2. WHEN the user opens a chit and views an attachment for the first time, THE Attachment_Manager SHALL download the file from the server and store it in the Attachment_Cache.
3. WHILE an attachment is downloading, THE App SHALL display a progress indicator in place of the attachment content.
4. IF an attachment download fails due to network unavailability, THEN THE App SHALL display a placeholder with a "Download when online" message and a retry button.
5. WHEN a previously downloaded attachment is accessed again, THE Attachment_Manager SHALL serve the file from the Attachment_Cache without re-downloading.

### Requirement 9: Attachment Eager Upload

**User Story:** As a user, I want attachments I add to chits uploaded to the server as soon as possible so that they are available on other devices.

#### Acceptance Criteria

1. WHEN the user adds an attachment to a chit, THE Attachment_Manager SHALL store the file locally in the Attachment_Cache immediately.
2. WHILE the device is online, WHEN a new attachment is added, THE Attachment_Manager SHALL upload the file to the server in the background.
3. IF the attachment upload fails due to network unavailability, THEN THE Attachment_Manager SHALL queue the upload for retry when connectivity returns.
4. WHEN the Connectivity_Monitor detects a transition from offline to online, THE Attachment_Manager SHALL upload all queued attachments.
5. WHEN an attachment upload succeeds, THE Attachment_Manager SHALL update the local attachment metadata with the server-assigned URL.

### Requirement 10: Attachment Cache Management

**User Story:** As a user, I want the app to manage attachment storage so that it does not fill up my device.

#### Acceptance Criteria

1. THE Attachment_Cache SHALL enforce a configurable maximum size limit for cached attachment files.
2. WHEN the Attachment_Cache exceeds the size limit, THE Attachment_Manager SHALL evict the least recently accessed files until the cache is within the limit.
3. WHEN a cached file is evicted, THE Attachment_Manager SHALL retain the attachment metadata so the file can be re-downloaded on next access.
4. THE App SHALL not evict attachments that have pending uploads (not yet synced to the server).

### Requirement 11: Local Notification Scheduling

**User Story:** As a user, I want to receive notifications for my chit alerts on my phone so that I am reminded of important items without depending on server connectivity.

#### Acceptance Criteria

1. WHEN a chit with alert data is synced or created locally, THE Notification_Scheduler SHALL schedule an exact alarm via AlarmManager for each alert time defined on the chit.
2. WHEN a chit's alert data is modified, THE Notification_Scheduler SHALL cancel any existing alarms for that chit and reschedule based on the updated alert times.
3. WHEN a chit is soft-deleted, THE Notification_Scheduler SHALL cancel all scheduled alarms for that chit.
4. THE Notification_Scheduler SHALL use `AlarmManager.setExactAndAllowWhileIdle()` to ensure alarms fire at the precise scheduled time even in Doze mode.
5. WHEN the device reboots, THE Notification_Scheduler SHALL re-register all active alarms by reading alert data from the Room_Database via a BOOT_COMPLETED BroadcastReceiver.

### Requirement 12: Notification Channels and Display

**User Story:** As a user, I want different notification types (alarms, reminders, timers) to have distinct behaviors so that I can distinguish urgency levels.

#### Acceptance Criteria

1. THE App SHALL create three Notification_Channels at startup: "Alarms" (high importance, sound enabled), "Reminders" (default importance, no sound), and "Timers" (high importance, sound enabled).
2. WHEN the Alarm_Receiver fires for an alarm-type alert, THE App SHALL display a notification on the "Alarms" channel with the chit title, a sound, and vibration.
3. WHEN the Alarm_Receiver fires for a reminder-type alert, THE App SHALL display a notification on the "Reminders" channel with the chit title and no sound.
4. WHEN the Alarm_Receiver fires for a timer-type alert, THE App SHALL display a notification on the "Timers" channel with the chit title, a sound, and vibration.
5. WHEN the user taps a notification, THE App SHALL navigate to the Chit_Editor for the associated chit.

### Requirement 13: Exact Alarm Permission

**User Story:** As a user, I want the app to request the necessary permissions for exact alarms so that notifications fire reliably.

#### Acceptance Criteria

1. THE App SHALL declare the `SCHEDULE_EXACT_ALARM` permission in the AndroidManifest for devices running Android 12 (API 31) and above.
2. WHEN the App detects that exact alarm permission is not granted (API 31+), THE App SHALL display a prompt directing the user to the system settings to grant the permission.
3. WHILE exact alarm permission is not granted on API 31+ devices, THE Notification_Scheduler SHALL fall back to inexact alarms via `AlarmManager.set()` and display a warning in the app settings.
4. THE App SHALL declare the `USE_EXACT_ALARM` permission in the AndroidManifest for devices running Android 13 (API 33) and above as an alternative to `SCHEDULE_EXACT_ALARM`.

### Requirement 14: Delete vs. Edit Conflict

**User Story:** As a user, I want a clear resolution when one device deletes a chit while another edits it so that data is not silently lost.

#### Acceptance Criteria

1. WHEN the App pulls a sync change where a chit has `deleted = true` from the server, THE App SHALL mark the local ChitEntity as deleted regardless of any local dirty edits on that chit.
2. WHEN a locally edited chit is overwritten by a server-side deletion, THE App SHALL clear the dirty state on that chit since the deletion takes precedence.
3. WHEN a locally edited chit is overwritten by a server-side deletion, THE App SHALL log the lost edit event locally for the user's awareness (visible in a future audit log view).

### Requirement 15: Checklist Reorder Conflict

**User Story:** As a user, I want checklist conflicts resolved simply so that I do not lose checklist data.

#### Acceptance Criteria

1. WHEN the server returns a "merged" status with "checklist" in `conflict_fields`, THE App SHALL replace the local checklist data entirely with the server's merged version (LWW on the entire checklist blob).
2. THE App SHALL treat the checklist field as an atomic unit for conflict resolution purposes, applying LWW rather than attempting item-level merge.

### Requirement 16: Tag Rename Propagation

**User Story:** As a user, I want tag renames from the server applied to all my local chits so that my tag organization stays consistent.

#### Acceptance Criteria

1. WHEN the App pulls a sync change that includes a tag rename operation, THE App SHALL update the tags array on all local ChitEntity records that contain the old tag name, replacing it with the new tag name.
2. WHEN the App applies a tag rename locally, THE App SHALL not mark the affected chits as dirty since the rename originated from the server.
3. WHEN the App applies a tag rename locally, THE App SHALL update any active UI views that display tag-based filtering or grouping to reflect the new tag name.

### Requirement 17: Database Migration (v2 → v3)

**User Story:** As a user upgrading from Phase 2, I want my existing data preserved when the app adds contacts and settings sync columns.

#### Acceptance Criteria

1. WHEN the App launches with a Room_Database at version 2, THE App SHALL execute a migration to version 3 that creates the Contact_Entity table with all required columns.
2. WHEN the App launches with a Room_Database at version 2, THE App SHALL execute a migration to version 3 that adds `is_dirty` and `sync_version` columns to the Settings_Entity if not already present.
3. WHEN the App launches with a Room_Database at version 2, THE App SHALL execute a migration to version 3 that adds a `conflict_fields` text column to ChitEntity for storing conflict field names.
4. THE App SHALL preserve all existing data during the migration from version 2 to version 3.

### Requirement 18: Push Request Extended Format

**User Story:** As a developer, I want the push request to include contacts and settings alongside chits so that all dirty data syncs in a single request.

#### Acceptance Criteria

1. WHEN the Sync_Push_Engine constructs a push request, THE App SHALL include dirty Contact_Entity records in the `contacts` array of the request body.
2. WHEN the Sync_Push_Engine constructs a push request, THE App SHALL include the dirty Settings_Entity in the `settings` object of the request body.
3. THE Sync_Push_Engine SHALL format the push request body as `{"chits": [...], "contacts": [...], "settings": {...}}` matching the server's expected schema.
4. WHEN no contacts are dirty, THE Sync_Push_Engine SHALL omit the `contacts` array or send an empty array in the push request.
5. WHEN settings are not dirty, THE Sync_Push_Engine SHALL omit the `settings` object from the push request.
