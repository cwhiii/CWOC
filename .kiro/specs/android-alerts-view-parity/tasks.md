# Implementation Plan: Android Alerts View Parity

## Overview

Complete rewrite of the Android Alerts view to achieve full parity with the web mobile browser version. The implementation covers four distinct modes (Chits, Independent, Notifications, Reminders), a standalone alerts data layer with Room caching, real-time timer/stopwatch runtimes, server-backed notifications, and full CRUD operations. Work is ordered by dependency: data layer first, then ViewModel rewrite, then UI composables per mode, and finally integration wiring.

## Tasks

- [x] 1. Data layer — Room entity, DAO, migration, API endpoints, repository
  - [x] 1.1 Create StandaloneAlertEntity and StandaloneAlertDao
    - Create `data/local/entity/StandaloneAlertEntity.kt` with Room `@Entity(tableName = "standalone_alerts")` containing columns: id (TEXT PRIMARY KEY), type (TEXT NOT NULL), name (TEXT), data (TEXT NOT NULL), createdDatetime (TEXT), modifiedDatetime (TEXT)
    - Create `data/local/dao/StandaloneAlertDao.kt` with queries: `getAll(): Flow<List<StandaloneAlertEntity>>`, `getByType(type: String): Flow<List<StandaloneAlertEntity>>`, `insert(entity: StandaloneAlertEntity)`, `insertAll(entities: List<StandaloneAlertEntity>)`, `update(entity: StandaloneAlertEntity)`, `deleteById(id: String)`, `deleteAll()`
    - _Requirements: 11.1_

  - [x] 1.2 Create Migration8To9 for standalone_alerts table
    - Create `data/local/migration/Migration8To9.kt` with SQL: `CREATE TABLE IF NOT EXISTS standalone_alerts (id TEXT NOT NULL PRIMARY KEY, type TEXT NOT NULL, name TEXT, data TEXT NOT NULL, createdDatetime TEXT, modifiedDatetime TEXT)`
    - Wrap in try/catch for idempotency
    - Register migration in `AppModule.provideCwocDatabase()` via `.addMigrations(...)`
    - Bump `@Database(version = 9)` on CwocDatabase and add `StandaloneAlertEntity::class` to entities array
    - Add `abstract fun standaloneAlertDao(): StandaloneAlertDao` to CwocDatabase
    - _Requirements: 11.1_

  - [x] 1.3 Add standalone-alerts API endpoints to CwocApiService
    - Add `GET /api/standalone-alerts` returning `Response<List<StandaloneAlertDto>>`
    - Add `POST /api/standalone-alerts` with `@Body body: Map<String, Any?>` returning `Response<StandaloneAlertDto>`
    - Add `PUT /api/standalone-alerts/{id}` with `@Body body: Map<String, Any?>` returning `Response<Unit>`
    - Add `DELETE /api/standalone-alerts/{id}` returning `Response<Unit>`
    - _Requirements: 11.4_

  - [x] 1.4 Create StandaloneAlertDto data class
    - Create `data/remote/dto/StandaloneAlertDto.kt` with fields: id (String), `_type` (String, serialized as `_type`), name (String?), data (Map<String, Any?>), created_datetime (String?), modified_datetime (String?)
    - Use `@SerializedName` annotations for snake_case API field mapping
    - _Requirements: 11.1, 11.4_

  - [x] 1.5 Create StandaloneAlertRepository
    - Create `data/repository/StandaloneAlertRepository.kt` injected with `CwocApiService` and `StandaloneAlertDao`
    - Implement `fetchAndCache()`: calls GET API, replaces all local rows with response via `deleteAll()` + `insertAll()`
    - Implement `getAll(): Flow<List<StandaloneAlertEntity>>` returning DAO flow
    - Implement `getByType(type: String): Flow<List<StandaloneAlertEntity>>` returning DAO flow
    - Implement `create(type: String, name: String?, data: Map<String, Any?>): Result<StandaloneAlertDto>` calling POST API, on success inserting into local cache
    - Implement `update(id: String, body: Map<String, Any?>): Result<Unit>` calling PUT API, on success updating local cache
    - Implement `delete(id: String): Result<Unit>` calling DELETE API, on success deleting from local cache
    - On API fetch failure, return existing cached data without error state
    - Provide the DAO and repository via Hilt in AppModule
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 2. Checkpoint — Ensure data layer compiles
  - Ensure all data layer changes compile without errors (entity, DAO, migration, API endpoints, repository, Hilt bindings), ask the user if questions arise.

- [x] 3. ViewModel rewrite — All 4 modes, timer/stopwatch runtimes, mode persistence
  - [x] 3.1 Create TimerRuntime state management class
    - Create `domain/alerts/TimerRuntime.kt` as a class managing in-memory timer state for a single timer
    - Fields: `totalSeconds` (Long), `remainingMs` (Long), `isRunning` (Boolean), `isDone` (Boolean), `loop` (Boolean)
    - Methods: `start()` — begins decrementing remaining every 100ms via coroutine; `pause()` — stops decrementing, preserves remaining; `reset()` — stops and restores remaining to totalSeconds; `setDuration(h, m, s)` — sets totalSeconds and remaining
    - When remaining reaches 0: set `isDone = true`, if loop restart after 1.5s delay, if not loop stay done for 2.5s then reset
    - Expose state as `StateFlow<TimerState>` where TimerState is a data class with remaining, total, isRunning, isDone fields
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 7.1_

  - [x] 3.2 Create StopwatchRuntime state management class
    - Create `domain/alerts/StopwatchRuntime.kt` as a class managing in-memory stopwatch state for a single stopwatch
    - Fields: `elapsedMs` (Long), `isRunning` (Boolean), `laps` (List<String>)
    - Methods: `start()` — begins incrementing elapsed every 50ms via coroutine; `pause()` — stops incrementing, preserves elapsed; `reset()` — stops, resets elapsed to 0, clears laps; `lap()` — if running, appends formatted elapsed to laps list as "Lap N: HH:MM:SS.cs"
    - Expose state as `StateFlow<StopwatchState>` where StopwatchState is a data class with elapsedMs, isRunning, laps fields
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.10, 7.1_

  - [x] 3.3 Rewrite AlertsViewModel for all 4 modes
    - Rewrite `ui/screens/alerts/AlertsViewModel.kt` injected with `ChitRepository`, `StandaloneAlertRepository`, `CwocApiService`, `SettingsRepository`, SharedPreferences
    - Add `selectedMode: StateFlow<String>` (one of "list", "independent", "notifications", "reminders") persisted in SharedPreferences key `alerts_view_mode`, defaulting to "independent"
    - Add `setMode(mode: String)` that validates mode string, updates state, persists to SharedPreferences, and triggers data load for the new mode
    - **Chits mode**: expose `alertChits: StateFlow<List<ChitEntity>>` from existing `chitRepository.getAlertChits()` flow, applying FilterSortViewModel filters
    - **Independent mode**: expose `standaloneAlerts: StateFlow<List<StandaloneAlertEntity>>` from repository, grouped by type; call `fetchAndCache()` on mode activation
    - **Notifications mode**: expose `notifications: StateFlow<List<NotificationDto>>` fetched from `getNotifications("mobile")`; split into unread (status=pending) and addressed (status!=pending)
    - **Reminders mode**: expose `reminders: StateFlow<List<ChitEntity>>` filtered from local chits where notification=true AND point_in_time IS NOT NULL, split into upcoming/past based on current time
    - Maintain a `Map<String, TimerRuntime>` and `Map<String, StopwatchRuntime>` keyed by standalone alert ID for active runtimes that persist across navigation
    - Add `isRefreshing: StateFlow<Boolean>` for pull-to-refresh indicator
    - Add `refresh()` method that re-fetches data for the current mode
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 3.2, 7.1, 7.2, 7.4, 8.1, 9.1, 10.1, 10.2, 10.3, 10.4_

  - [x] 3.4 Add notification actions to AlertsViewModel
    - Implement `acceptNotification(id: String)` calling PATCH with `{status: "accepted"}`
    - Implement `declineNotification(id: String)` calling PATCH with `{status: "declined"}`
    - Implement `dismissNotification(id: String)` calling PATCH with `{status: "dismissed"}`
    - Implement `snoozeNotification(id: String, minutes: Int)` calling POST snooze endpoint
    - Implement `deleteNotification(id: String)` calling DELETE endpoint
    - Implement `clearAddressed()` that deletes all addressed notifications one by one
    - On success, update local notifications state; on failure, show error and retain current state
    - _Requirements: 8.6, 8.7, 8.8, 8.9, 8.11, 8.12, 8.14_

  - [x] 3.5 Add standalone alert CRUD methods to AlertsViewModel
    - Implement `createAlarm()` — POST with defaults: time = current time + 1 min as "HH:MM", days = [today's abbreviation], enabled = true, name = ""
    - Implement `createTimer()` — POST with defaults: totalSeconds = 0, loop = false, name = ""
    - Implement `createStopwatch()` — POST with defaults: name = "", then auto-start the StopwatchRuntime for the new ID
    - Implement `updateStandaloneAlert(id: String, body: Map<String, Any?>)` calling repository update
    - Implement `deleteStandaloneAlert(id: String)` calling repository delete, also removing any associated TimerRuntime or StopwatchRuntime
    - _Requirements: 3.6, 4.9, 5.15, 6.9, 4.2, 4.4, 4.6, 4.7, 4.8, 5.13, 5.14, 6.7, 6.8_

  - [x] 3.6 Add reminder actions to AlertsViewModel
    - Implement `toggleReminderPin(chitId: String)` toggling pinned state via ChitRepository
    - Implement `completeReminder(chitId: String)` setting status=Complete and archived=true via ChitRepository (with delayed execution for undo support)
    - Implement `cancelComplete(chitId: String)` cancelling the pending complete operation (undo)
    - Implement `archiveReminder(chitId: String)` toggling archived state via ChitRepository
    - Implement `deleteReminder(chitId: String)` soft-deleting via ChitRepository after confirmation
    - _Requirements: 9.6, 9.7, 9.8, 9.9, 9.10_

  - [x] 3.7 Add timer completion notification trigger
    - When a TimerRuntime reaches 0, call the existing NotificationScheduler pattern to fire a local notification with the timer name in the content
    - This should work even when the user is on a different screen (ViewModel is still alive)
    - _Requirements: 7.3_

- [x] 4. Checkpoint — Ensure ViewModel compiles
  - Ensure AlertsViewModel, TimerRuntime, and StopwatchRuntime compile without errors and all Hilt injections resolve, ask the user if questions arise.

- [x] 5. UI — Independent Alerts Board
  - [x] 5.1 Build IndependentAlertsBoard composable
    - Create `ui/screens/alerts/IndependentAlertsBoard.kt`
    - Render three vertically stacked sections labeled "🔔 Alarms", "⏱️ Timers", "⏲️ Stopwatches"
    - Each section has a header row with label and "+" button calling the corresponding create method on the ViewModel
    - Each section renders a LazyColumn of cards for that type, or empty state text "No independent {alarms/timers/stopwatches} yet." when empty
    - Accept ViewModel as parameter to access standaloneAlerts, timerRuntimes, stopwatchRuntimes
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [x] 5.2 Build IndependentAlarmCard composable
    - Create `ui/screens/alerts/IndependentAlarmCard.kt`
    - Display editable name TextField (placeholder "Alarm name"), saving on focus loss via `updateStandaloneAlert`
    - Display time formatted per `time_format` setting (12h with AM/PM or 24h), tappable to open Android TimePickerDialog pre-populated with current time
    - On time selection: update time, auto-select today's day if no days selected, save via PUT
    - Display 7 day-of-week checkboxes ordered starting from `week_start_day` setting, toggling days array and saving on change
    - Display On/Off toggle button with text label; when disabled, dim name/time/days to reduced opacity; save on toggle
    - Display ❌ delete button calling DELETE without confirmation
    - All saves call `viewModel.updateStandaloneAlert(id, updatedBody)`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10, 4.11, 12.1, 12.2_

  - [x] 5.3 Build IndependentTimerCard composable
    - Create `ui/screens/alerts/IndependentTimerCard.kt`
    - Display editable name TextField, saving on focus loss
    - Display loop checkbox (🔁), saving on toggle
    - Display ❌ delete button
    - **Stopped/Reset state**: show HH:MM:SS number input fields (HH >= 0, MM 0-59, SS 0-59) for setting duration
    - **Running state**: show horizontal progress bar (remaining/total * 100%), remaining time text in HH:MM:SS format (or HH:MM:SS.T when < 10 seconds), tapping bar pauses timer
    - **Done state**: show "✓ DONE" text on progress bar
    - **Paused state**: show progress bar with frozen value; tapping paused bar shows duration inputs
    - Controls: Start button (disabled if duration is 0), Pause button (when running), Reset button
    - Wire Start/Pause/Reset to TimerRuntime methods via ViewModel
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.16_

  - [x] 5.4 Build IndependentStopwatchCard composable
    - Create `ui/screens/alerts/IndependentStopwatchCard.kt`
    - Display editable name TextField, saving on focus loss
    - Display ❌ delete button (stops any running interval before deleting)
    - Display elapsed time in HH:MM:SS.cs format (centiseconds), updating every 50ms when running, initially "00:00:00.00"
    - Display Start/Pause toggle button ("▶ Start" / "⏸ Pause")
    - Display Lap button (only active when running, ignored otherwise)
    - Display Reset button (stops, resets to 00:00:00.00, clears laps)
    - Display laps list below controls: "Lap 1: HH:MM:SS.cs", "Lap 2: ..." etc.
    - Wire all controls to StopwatchRuntime methods via ViewModel
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10_

- [x] 6. Checkpoint — Ensure Independent Board UI compiles
  - Ensure IndependentAlertsBoard and all three card composables compile without errors, ask the user if questions arise.

- [x] 7. UI — Notifications View
  - [x] 7.1 Build NotificationsView composable
    - Create `ui/screens/alerts/NotificationsView.kt`
    - Split notifications into "📬 Unread" section (status = "pending", sorted by created_datetime descending) and "📭 Addressed" section (status != "pending", sorted by created_datetime descending)
    - Each notification card displays: chit title (tappable to navigate to editor if chit_id exists), type info ("Assigned by: {name}" for type "assigned", "{delivery_target} reminder" for type "reminder"), sent date, due date (if present), start date (if present)
    - For `notification_type == "reminder"` with status "pending": show Snooze button ("Snooze {N}m" using snooze_length setting, default 5) and Dismiss button
    - For other notification types: show Accept/Decline pill toggle with current status visually indicated if already acted upon
    - Addressed cards render at 0.7 opacity with status badge (accepted/declined/dismissed/snoozed)
    - Each addressed card has a Delete button
    - "📭 Addressed" section header includes "Clear Addressed" button with confirmation dialog before bulk delete
    - Empty state: "No notifications."
    - On API failure for any action: show error toast, retain card in current state
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14_

- [x] 8. UI — Reminders View
  - [x] 8.1 Build RemindersView composable
    - Create `ui/screens/alerts/RemindersView.kt`
    - Split reminders into "⏰ Upcoming ({count})" section (point_in_time >= now) and "📭 Past ({count})" section (point_in_time < now)
    - Each reminder card displays: pin toggle button (filled bookmark if pinned, outline if not), chit title (tappable to navigate to editor), action buttons visible on card (Complete ✓, Archive, Delete), meta row "📢 {YYYY-Mon-DD HH:MM}" using point_in_time formatted per time_format setting
    - If point_in_time < now AND status != Complete: show red "past" badge next to date
    - If status == Complete: show green "✓ done" badge next to date, render card at reduced opacity
    - Pin button: toggle pinned state via ViewModel
    - Complete button: immediately fade card, show undo toast with countdown; on expiry set status=Complete and archived=true; on Undo restore card
    - Archive button: toggle archived state via ViewModel
    - Delete button: show confirmation dialog, on confirm soft-delete via ViewModel
    - Empty state: "No reminders."
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11_

- [x] 9. UI — Chits List View
  - [x] 9.1 Build ChitAlertsListView composable
    - Create `ui/screens/alerts/ChitAlertsListView.kt`
    - Render each alert-bearing chit as a card with: chit title (tappable to navigate to editor), chit color applied to card background, alert summary row showing only non-zero counts by type (📢 N, 🔔 N, ⏱️ N, ⏲️ N) where N is count of matching entries in alerts array for that type (or 1 if boolean flag is true but no array entries)
    - Long-press on card shows ChitActionMenu with pin, archive, snooze, edit, delete actions
    - Apply FilterSortViewModel filters (tags, status) and current sort order; pinned chits display before unpinned regardless of sort
    - Empty state: "No chits with alerts found."
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 10. Checkpoint — Ensure all mode UI composables compile
  - Ensure NotificationsView, RemindersView, and ChitAlertsListView compile without errors, ask the user if questions arise.

- [x] 11. Integration and wiring — AlertsScreen rewrite
  - [x] 11.1 Rewrite AlertsScreen with mode toggle and content switching
    - Rewrite `ui/screens/alerts/AlertsScreen.kt` to display Mode_Toggle row with four FilterChips: "📋 Chits", "🛎️ Independent", "🔔 Notifs", "📢 Reminders" with exactly one selected at all times
    - On chip tap: update ViewModel mode (persists to SharedPreferences), switch content area to corresponding composable within 300ms
    - Content area renders: ChitAlertsListView for "list", IndependentAlertsBoard for "independent", NotificationsView for "notifications", RemindersView for "reminders"
    - On screen open: restore persisted mode from ViewModel (defaults to "independent" if none or invalid)
    - Wrap content in SwipeRefresh (or Modifier.pullRefresh) calling `viewModel.refresh()` for pull-to-refresh on all modes
    - Show platform pull-to-refresh indicator while refreshing; on failure dismiss indicator and keep previous data
    - Pass `onNavigateToEditor` callback through to all child composables
    - Pass FilterSortViewModel and ChitRepository for Chits mode filtering and long-press actions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 11.2 Wire time format and week start day settings
    - Ensure all time displays (alarm times, notification dates, reminder dates) read `time_format` from SettingsRepository and format accordingly (12h with AM/PM or 24h)
    - Ensure alarm day-of-week checkboxes read `week_start_day` from SettingsRepository and order days starting from that index
    - _Requirements: 12.1, 12.2_

- [x] 12. Final checkpoint — Ensure all modes work end-to-end
  - Ensure all code compiles, all modes render correctly, pull-to-refresh works, timer/stopwatch runtimes persist across navigation, and mode persistence works. Ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Timer/stopwatch runtimes are in-memory only — if the app process is killed, they reset to stopped state (Requirement 7.4)
- The existing NotificationDto in CwocApiService already covers the notifications API response format
- Room version bumps from 8 to 9 with the new standalone_alerts table
- No test-writing tasks included per user request

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.5"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6", "3.7"] },
    { "id": 5, "tasks": ["5.1", "7.1", "8.1", "9.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["11.2"] }
  ]
}
```
