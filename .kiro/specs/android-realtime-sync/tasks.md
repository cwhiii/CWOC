# Implementation Plan: Android Real-Time Sync

## Overview

Add a foreground service-based WebSocket connection to the Android app so data changes are received instantly regardless of whether the app UI is in the foreground, background, or closed. The implementation modifies `WebSocketClientImpl` (parameter adjustments + 10-attempt cap + 401 handling + connection state flow), enhances `SyncOrchestrator` (sync coalescing + single-retry + catch-up sync), creates a new `SyncForegroundService` that owns the WebSocket lifecycle, simplifies `AppLifecycleObserver` to just ensure the service is running, adds a `cwoc_sync_service` notification channel, updates `BootReceiver` to start the service on boot, adds a battery optimization prompt, and declares the foreground service in `AndroidManifest.xml`.

## Tasks

- [x] 1. Add lifecycle-process dependency and modify WebSocketClientImpl
  - [x] 1.1 Add `androidx.lifecycle:lifecycle-process` dependency to `build.gradle.kts`
    - Add `implementation("androidx.lifecycle:lifecycle-process:2.7.0")` to the dependencies block
    - This provides `ProcessLifecycleOwner` for app-level foreground/background detection
    - _Requirements: 4.1_

  - [x] 1.2 Modify `WebSocketClientImpl` backoff parameters, attempt cap, 401 handling, and connection state
    - Change `INITIAL_BACKOFF_MS` from `2_000L` to `1_000L`
    - Change `MAX_BACKOFF_MS` from `60_000L` to `30_000L`
    - Add `MAX_RECONNECT_ATTEMPTS = 10` constant
    - Add `reconnectAttempts: Int = 0` counter field
    - Add `permanentlyDisabled: Boolean = false` field
    - Add `connectionState: StateFlow<WebSocketConnectionState>` (CONNECTED, RECONNECTING, DISCONNECTED) for notification updates
    - In `scheduleReconnect()`: increment `reconnectAttempts`, stop if >= 10 or `permanentlyDisabled`; emit RECONNECTING state
    - In `onOpen()`: reset `reconnectAttempts = 0`; emit CONNECTED state
    - In `onFailure()`: detect 401 from `response?.code` — if 401, set `permanentlyDisabled = true` and do NOT schedule reconnect
    - In `onClosed()`/`onFailure()`: emit DISCONNECTED state when not reconnecting
    - Add `resetBackoff()` public method that resets `currentBackoffMs`, `reconnectAttempts`, and `reconnecting` flag
    - In `connect()`: also reset `reconnectAttempts = 0` and `permanentlyDisabled = false`
    - Guard `connect()` to be a no-op if token is null/blank (add early return)
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 3.1, 3.5, 3.6, 3.7, 7.6, 8.5_

- [x] 2. Enhance SyncOrchestrator with coalescing, retry, and catch-up sync
  - [x] 2.1 Add sync coalescing logic to `SyncOrchestrator.handleWebSocketMessage()`
    - Add `syncMutex = Mutex()`, `syncInProgress = false`, `syncQueued = false` fields
    - When a recognized message arrives: if `syncInProgress`, set `syncQueued = true` and return
    - Otherwise: set `syncInProgress = true`, perform sync, then check `syncQueued` — if true, reset flag and perform one more sync
    - After all syncs complete, set `syncInProgress = false`
    - Expand recognized message types to include: `chits_changed`, `settings_changed`, `contacts_changed`, `change`, `changes_available`
    - Log unrecognized types at debug level
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.2_

  - [x] 2.2 Add single-retry-on-failure logic and catch-up sync on reconnect
    - If sync triggered by WebSocket message fails: schedule a single retry after 5 seconds via a `retryJob: Job?` field
    - If the retry also fails: do nothing further (wait for next message)
    - Cancel `retryJob` when service stops
    - Add a collector on `webSocketClient.isConnected` — when it transitions from false→true (reconnection), trigger an immediate catch-up sync
    - _Requirements: 2.5, 3.3_

  - [x] 2.3 Update `handleOnline()` to reset WebSocket backoff and reconnect
    - When `ConnectivityEvent.Online` fires: call `webSocketClient.resetBackoff()` then `webSocketClient.connect()` (immediate reconnect on network restore)
    - This ensures the backoff timer and attempt counter are reset on connectivity change
    - _Requirements: 3.2, 3.7_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create SyncForegroundService that owns the WebSocket lifecycle
  - [x] 4.1 Create `SyncForegroundService` class
    - New file: `android/app/src/main/java/com/cwoc/app/data/sync/SyncForegroundService.kt`
    - `@AndroidEntryPoint` service with `@Inject lateinit var syncWebSocketManager: SyncWebSocketManager`
    - `companion object` with `NOTIFICATION_ID = 9001`, `ACTION_STOP`, `start(context)`, `stop(context)` helper methods
    - `onStartCommand()`: call `startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)`, then `syncWebSocketManager.connect()`, return `START_STICKY`
    - `onDestroy()`: call `syncWebSocketManager.disconnect()`
    - `onBind()`: return null
    - `buildNotification()`: create notification on `cwoc_sync_service` channel with app icon, text "CWOC connected", `setOngoing(true)`, priority `PRIORITY_MIN`
    - Collect `webSocketClient.connectionState` flow to update notification text ("CWOC connected" vs "CWOC reconnecting...")
    - Runs in same process as main app (no `android:process` attribute)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.2, 8.3, 8.4, 8.5, 11.1, 11.3, 11.5, 11.6_

  - [x] 4.2 Wire service start/stop into login and logout flows
    - After successful login (device_token stored): call `SyncForegroundService.start(context)`
    - On logout (device_token removed): call `SyncForegroundService.stop(context)`
    - _Requirements: 11.1, 11.2_

- [x] 5. Create simplified AppLifecycleObserver and wire into CwocApplication
  - [x] 5.1 Create `AppLifecycleObserver` class
    - New file: `android/app/src/main/java/com/cwoc/app/data/sync/AppLifecycleObserver.kt`
    - `@Singleton` class with `@Inject constructor(prefs: SharedPreferences)`
    - Implements `DefaultLifecycleObserver`
    - `onStart()`: if `prefs.getString("device_token", null)?.isNotBlank() == true`, call `SyncForegroundService.start(appContext)` — ensures service is running in case Android killed it
    - `onStop()`: do nothing — service stays alive in background
    - Does NOT call connect/disconnect — that's the service's job
    - Does NOT interact with WorkManager or SyncWorker
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.2, 6.3_

  - [x] 5.2 Wire `AppLifecycleObserver` into `CwocApplication.onCreate()`
    - Add `@Inject lateinit var appLifecycleObserver: AppLifecycleObserver` field to `CwocApplication`
    - In `onCreate()`, after existing setup: `ProcessLifecycleOwner.get().lifecycle.addObserver(appLifecycleObserver)`
    - Import `androidx.lifecycle.ProcessLifecycleOwner`
    - _Requirements: 4.1, 6.3_

- [x] 6. Add notification channel and update BootReceiver
  - [x] 6.1 Add `cwoc_sync_service` notification channel in `NotificationChannelManager`
    - Add `const val CHANNEL_ID_SYNC_SERVICE = "cwoc_sync_service"` to companion object
    - In `createChannels()`: create channel with name "Sync Service", importance `IMPORTANCE_MIN`, `setShowBadge(false)`, description "Persistent notification for the background sync connection"
    - Add to the `createNotificationChannels()` list call alongside existing channels
    - _Requirements: 8.1, 8.6_

  - [x] 6.2 Update `BootReceiver` to start `SyncForegroundService` on boot
    - In `onReceive()`, after checking `ACTION_BOOT_COMPLETED`: read `device_token` from SharedPreferences
    - If token is non-blank: call `SyncForegroundService.start(context)`
    - Place this before the existing alarm rescheduling logic
    - _Requirements: 11.4_

- [x] 7. Add battery optimization prompt and AndroidManifest updates
  - [x] 7.1 Create `BatteryOptimizationHelper` utility
    - New file: `android/app/src/main/java/com/cwoc/app/util/BatteryOptimizationHelper.kt`
    - `object BatteryOptimizationHelper` with:
      - `PREF_BATTERY_PROMPT_SHOWN` constant
      - `shouldShowPrompt(context, prefs)`: returns true if prompt not previously shown AND app is not already ignoring battery optimizations
      - `recordPromptShown(prefs)`: writes `true` to SharedPreferences
      - `requestExemption(context)`: launches `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` intent with app package URI
    - Called once after successful login — show dialog explaining recommendation, then call `requestExemption()` on accept or `recordPromptShown()` on dismiss
    - One-time per device regardless of login/logout cycles
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 7.2 Update `AndroidManifest.xml` for foreground service
    - Add `<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />`
    - Add `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />`
    - Add `<service android:name=".data.sync.SyncForegroundService" android:foregroundServiceType="dataSync" android:exported="false" />` inside `<application>`
    - Verify `RECEIVE_BOOT_COMPLETED` permission already exists (for BootReceiver)
    - _Requirements: 7.5, 11.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `SyncEngine` and `SyncWorker` are UNCHANGED — no modifications needed
- The `WebSocketClient` interface gains a `resetBackoff()` method signature and `connectionState` flow
- Property 9 (Idempotent Upsert) is already guaranteed by the existing `SyncEngine.performSync()` using `upsertAll()` — no new code needed
- The existing `SyncOrchestrator.start()` already collects connectivity events and WebSocket messages — the enhancements build on that existing infrastructure
- `SyncForegroundService` owns the WebSocket lifecycle — `AppLifecycleObserver` only ensures the service is running
- The service uses `START_STICKY` so Android restarts it if killed by memory pressure
- `BootReceiver` starts the service on device boot if authenticated
- Battery optimization prompt is one-time after login to improve service reliability

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "7.2"] },
    { "id": 3, "tasks": ["4.1", "5.1", "7.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "6.2"] }
  ]
}
```
