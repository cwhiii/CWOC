# Requirements Document

## Introduction

This document specifies the requirements for Phase 1 of the CWOC Android app — a read-only native client that authenticates against the existing CWOC server, pulls all chit/contact/settings data via the sync API, stores it locally in a Room database, and displays it in native Jetpack Compose views. No local editing is supported in this phase; the app is a viewer only.

## Glossary

- **App**: The CWOC Android application built with Kotlin and Jetpack Compose, targeting API 26+ (Android 8.0+)
- **Server**: The existing CWOC FastAPI backend providing REST endpoints for authentication and sync
- **Room_Database**: The local SQLite database managed by Android Room ORM, storing synced data on-device
- **Sync_Engine**: The component responsible for pulling data from the Server and populating the Room_Database
- **Auth_Manager**: The component responsible for device token authentication and secure token storage
- **Navigation_Bar**: The bottom navigation bar providing access to all six C CAPTN tabs
- **Chit**: A flexible record that can serve as a task, note, calendar event, alarm, checklist, or project
- **Device_Token**: A long-lived Bearer token issued by the Server for authenticating API requests
- **High_Water_Mark**: The server_version value stored locally representing the last successful sync point
- **Skeleton_UI**: A placeholder loading interface showing content structure before data is available

## Requirements

### Requirement 1: Project Foundation

**User Story:** As a developer, I want a properly configured Android project with all required dependencies, so that I can build features on a stable foundation.

#### Acceptance Criteria

1. THE App SHALL target a minimum SDK of API 26 (Android 8.0 Oreo)
2. THE App SHALL use Kotlin as the primary programming language
3. THE App SHALL use Jetpack Compose for all UI rendering
4. THE App SHALL use Hilt for dependency injection
5. THE App SHALL use Room for local database persistence
6. THE App SHALL use Retrofit with OkHttp for network communication
7. THE App SHALL use Compose Navigation for screen routing
8. THE App SHALL use the package name `com.cwoc.app`

### Requirement 2: Visual Theming

**User Story:** As a user, I want the Android app to match the CWOC parchment aesthetic, so that the experience feels consistent with the web app.

#### Acceptance Criteria

1. THE App SHALL apply Material 3 theming with a primary color of `#6b4e31`
2. THE App SHALL use a background color of `#fffaf0`
3. THE App SHALL use a surface color of `#f5e6d3`
4. THE App SHALL use the Lora font family as the primary typeface
5. THE App SHALL maintain a minimum text contrast ratio of 4.5:1 against background surfaces

### Requirement 3: Server URL Configuration

**User Story:** As a user, I want to configure the server URL before logging in, so that I can connect to my specific CWOC server instance.

#### Acceptance Criteria

1. THE App SHALL display a server URL input field on the login screen
2. THE App SHALL persist the configured server URL across app restarts
3. THE App SHALL pre-populate the server URL field with the last successfully used URL
4. WHEN the user submits a server URL, THE App SHALL validate that the URL uses HTTPS or HTTP protocol
5. IF the server URL field is empty, THEN THE App SHALL prevent the login attempt and display a validation message

### Requirement 4: Authentication

**User Story:** As a user, I want to log in with my CWOC credentials, so that I can access my data on the Android app.

#### Acceptance Criteria

1. THE App SHALL display a login screen with username and password fields
2. WHEN the user submits credentials, THE App SHALL send a POST request to `/api/auth/device-token` with the username, password, and a device_name derived from the Android device model
3. WHEN the Server returns a successful authentication response, THE Auth_Manager SHALL store the returned token in Android EncryptedSharedPreferences
4. WHEN the Server returns a successful authentication response, THE App SHALL navigate to the main content screen
5. IF the Server returns a 401 or 403 response to the login request, THEN THE App SHALL display an "Invalid credentials" error message on the login screen
6. IF the network is unreachable during login, THEN THE App SHALL display a "Cannot reach server" error message on the login screen
7. THE Auth_Manager SHALL include the stored token as an `Authorization: Bearer <token>` header on all subsequent API requests

### Requirement 5: Token Revocation Handling

**User Story:** As a user, I want to be redirected to login when my token is revoked, so that I can re-authenticate and regain access.

#### Acceptance Criteria

1. WHEN any API request returns a 401 response, THE App SHALL clear the stored device token from EncryptedSharedPreferences
2. WHEN any API request returns a 401 response, THE App SHALL navigate the user to the login screen
3. WHEN the App redirects to login due to token revocation, THE App SHALL display a message indicating the session has expired

### Requirement 6: Local Database Schema

**User Story:** As a developer, I want Room entities that mirror the server schema, so that synced data can be stored and queried locally.

#### Acceptance Criteria

1. THE Room_Database SHALL define a ChitEntity with fields matching the server chit model including: id, title, note, tags, start_datetime, end_datetime, due_datetime, status, priority, severity, checklist, people, color, location, all_day, pinned, archived, deleted, sync_version, has_unviewed_conflict, habit, recurrence_rule, owner_id, shares, and assigned_to
2. THE Room_Database SHALL define a ContactEntity with fields matching the server contact model including a sync_version field
3. THE Room_Database SHALL define a SettingsEntity with fields matching the server settings model including a sync_version field
4. THE Room_Database SHALL store a last_synced_at timestamp on each entity indicating when the record was last updated from the Server
5. THE Room_Database SHALL store the High_Water_Mark value representing the last successful sync version

### Requirement 7: Initial Full Sync

**User Story:** As a user, I want all my data downloaded on first login, so that I can immediately browse my chits, contacts, and settings.

#### Acceptance Criteria

1. WHEN the user logs in for the first time, THE Sync_Engine SHALL request `GET /api/sync/changes?since=0&include=chits,contacts,settings` from the Server
2. WHEN the Sync_Engine receives the full sync response, THE Sync_Engine SHALL insert all chit records into the Room_Database ChitEntity table
3. WHEN the Sync_Engine receives the full sync response, THE Sync_Engine SHALL insert all contact records into the Room_Database ContactEntity table
4. WHEN the Sync_Engine receives the full sync response, THE Sync_Engine SHALL insert the settings record into the Room_Database SettingsEntity table
5. WHEN the Sync_Engine completes the initial sync, THE Sync_Engine SHALL store the returned server_version as the High_Water_Mark
6. WHILE the initial sync is in progress, THE App SHALL display a Skeleton_UI indicating content is loading

### Requirement 8: Progressive Sync (Auto-Refresh)

**User Story:** As a user, I want my data to stay current while I'm using the app, so that I see changes made on the web without manually refreshing.

#### Acceptance Criteria

1. WHILE the App is in the foreground, THE Sync_Engine SHALL poll for changes every 5 minutes using `GET /api/sync/changes?since={High_Water_Mark}&include=chits,contacts,settings`
2. WHEN the Sync_Engine receives an incremental sync response, THE Sync_Engine SHALL upsert changed records into the Room_Database
3. WHEN the Sync_Engine completes an incremental sync, THE Sync_Engine SHALL update the High_Water_Mark to the returned server_version
4. IF an incremental sync request fails due to a network error, THEN THE Sync_Engine SHALL retry on the next polling interval without displaying an error to the user

### Requirement 9: Bottom Navigation

**User Story:** As a user, I want a bottom navigation bar with all six C CAPTN tabs, so that I can access different views of my data.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL display six tabs: Calendar, Checklists, Alarms, Projects, Tasks, and Notes
2. WHEN the user taps a tab, THE App SHALL navigate to the corresponding view
3. THE Navigation_Bar SHALL visually indicate which tab is currently active
4. WHEN the user navigates to the Checklists tab, THE App SHALL display a "Coming Soon" placeholder screen
5. WHEN the user navigates to the Alarms tab, THE App SHALL display a "Coming Soon" placeholder screen
6. WHEN the user navigates to the Projects tab, THE App SHALL display a "Coming Soon" placeholder screen

### Requirement 10: Tasks View

**User Story:** As a user, I want to see my tasks grouped by status, so that I can quickly review what needs attention.

#### Acceptance Criteria

1. THE App SHALL display chits with a non-null status field in the Tasks view
2. THE App SHALL group tasks by status: ToDo, In Progress, Blocked, and Complete
3. THE App SHALL display each task with its title, priority indicator, and due date when present
4. THE App SHALL exclude archived and deleted chits from the Tasks view
5. WHEN the Room_Database is updated by the Sync_Engine, THE Tasks view SHALL reflect the updated data without requiring manual refresh

### Requirement 11: Notes View

**User Story:** As a user, I want to read my notes with rendered markdown, so that I can review formatted content on my phone.

#### Acceptance Criteria

1. THE App SHALL display chits categorized as notes in the Notes view
2. THE App SHALL render the note field content as formatted markdown including headings, bold, italic, lists, and code blocks
3. THE App SHALL display each note with its title
4. THE App SHALL exclude archived and deleted chits from the Notes view
5. WHEN the Room_Database is updated by the Sync_Engine, THE Notes view SHALL reflect the updated data without requiring manual refresh

### Requirement 12: Calendar View

**User Story:** As a user, I want to see my calendar events in day and week views, so that I can check my schedule on my phone.

#### Acceptance Criteria

1. THE App SHALL display chits with start_datetime or end_datetime values in the Calendar view
2. THE App SHALL provide a day view showing events for a single selected day
3. THE App SHALL provide a week view showing events across seven days
4. THE App SHALL allow the user to switch between day and week views
5. THE App SHALL display each calendar event with its title, time range, and color when present
6. THE App SHALL visually distinguish all-day events from timed events
7. THE App SHALL exclude archived and deleted chits from the Calendar view
8. WHEN the Room_Database is updated by the Sync_Engine, THE Calendar view SHALL reflect the updated data without requiring manual refresh

### Requirement 13: Read-Only Enforcement

**User Story:** As a user, I want to understand that this app is view-only, so that I don't expect editing capabilities.

#### Acceptance Criteria

1. THE App SHALL NOT provide any UI controls for creating new chits
2. THE App SHALL NOT provide any UI controls for editing existing chits
3. THE App SHALL NOT provide any UI controls for deleting or archiving chits
4. THE App SHALL NOT send any POST requests to `/api/sync/push`
