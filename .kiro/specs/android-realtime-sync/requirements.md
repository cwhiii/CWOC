# Requirements Document

## Introduction

Add real-time WebSocket synchronization to the Android app. The app maintains a persistent WebSocket connection to the server's existing `/ws/sync` endpoint via a foreground service, ensuring instant delivery of data changes (including alarms and timers) regardless of whether the app UI is in the foreground or background. On receiving a message, the app triggers an immediate sync via the existing SyncEngine. A foreground service (`SyncForegroundService`) keeps the WebSocket alive at all times — similar to how FairEmail maintains IMAP IDLE connections. The existing 5-minute WorkManager periodic sync continues as a secondary fallback. No server-side changes are required — the feature reuses the existing WebSocket endpoint already used by desktop web browsers.

**Platform scope:** App only (Android).

## Glossary

- **SyncWebSocketManager**: A singleton class responsible for establishing, maintaining, and closing the OkHttp WebSocket connection to the server's `/ws/sync` endpoint.
- **SyncForegroundService**: A foreground service that keeps the WebSocket connection alive regardless of app UI lifecycle state, showing a persistent low-priority notification.
- **AppLifecycleObserver**: A LifecycleObserver that hooks into ProcessLifecycleOwner to detect app foreground/background transitions and ensures the foreground service is running.
- **SyncEngine**: The existing singleton that performs incremental sync by calling `GET /api/sync/changes?since=N` and applying changes to the local Room database.
- **SyncWorker**: The existing WorkManager CoroutineWorker that runs SyncEngine every 5 minutes as a background fallback.
- **WebSocket_Endpoint**: The server's existing WebSocket endpoint at `/ws/sync` that broadcasts JSON messages with a `type` field to all connected clients.
- **High_Water_Mark**: The integer version number stored in SyncMetadata representing the last successfully synced server version.
- **Sync_Message**: A JSON object received over the WebSocket containing at minimum a `type` field with values such as `chits_changed`, `settings_changed`, or `contacts_changed`.
- **OkHttpClient**: The existing singleton OkHttp client configured with the trust-all-certificates TrustManager for self-signed HTTPS on the local network.
- **ProcessLifecycleOwner**: The Android Architecture Components class that provides app-level lifecycle events (ON_START for foreground, ON_STOP for background).
- **NotificationScheduler**: The existing component that schedules alarms and timers via AlarmManager when chits with alert data are synced.
- **BootReceiver**: The existing BroadcastReceiver that handles BOOT_COMPLETED to restart services and reschedule alarms after device reboot.
- **Battery_Optimization**: Android's Doze and App Standby system that can kill foreground services; apps can request exemption via `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.

## Requirements

### Requirement 1: WebSocket Connection Management

**User Story:** As a user, I want the app to maintain a WebSocket connection to the server while I'm actively using it, so that I receive data changes instantly without waiting for the 5-minute polling interval.

#### Acceptance Criteria

1. WHEN the app enters the foreground (ON_START lifecycle event), THE SyncWebSocketManager SHALL open a WebSocket connection to the server's `/ws/sync` endpoint using the configured server URL and device token if not already connected.
2. THE SyncWebSocketManager SHALL NOT close the WebSocket connection when the app enters the background — the connection is maintained by the SyncForegroundService.
3. THE SyncWebSocketManager SHALL reuse the existing singleton OkHttpClient (with its trust-all-certificates configuration) for the WebSocket connection.
4. IF the server URL or device token is not configured, THEN THE SyncWebSocketManager SHALL not attempt a WebSocket connection and SHALL log the reason.
5. THE SyncWebSocketManager SHALL construct the WebSocket URL by replacing the `https://` scheme with `wss://` (or `http://` with `ws://`) from the configured server URL and appending `/ws/sync`.
6. THE SyncWebSocketManager SHALL include the device token in the WebSocket handshake request as an `Authorization: Bearer <token>` header.
7. IF the WebSocket connection closes unexpectedly or fails while the SyncForegroundService is running, THEN THE SyncWebSocketManager SHALL attempt to reconnect using exponential backoff starting at 1 second, doubling on each attempt, capped at 30 seconds maximum delay.
8. WHEN the WebSocket connection is successfully established, THE SyncWebSocketManager SHALL reset the reconnection backoff delay to the initial 1-second value.

### Requirement 2: Real-Time Sync Trigger

**User Story:** As a user, I want data changes made on other devices to appear on my phone immediately, so that I always see the latest information without manually refreshing.

#### Acceptance Criteria

1. WHEN a Sync_Message is received over the WebSocket with a `type` field value of `chits_changed`, `settings_changed`, or `contacts_changed`, THE SyncWebSocketManager SHALL trigger SyncEngine.performSync() using the current High_Water_Mark.
2. WHILE a sync triggered by a WebSocket message is already in progress, THE SyncWebSocketManager SHALL not trigger an additional concurrent sync but SHALL queue one follow-up sync to run after the current sync completes, coalescing any additional messages received during the queued state into that single follow-up sync.
3. WHEN a Sync_Message is received with an unrecognized `type` field value, THE SyncWebSocketManager SHALL ignore the message and log it at debug level.
4. THE SyncWebSocketManager SHALL retrieve the current High_Water_Mark from SyncMetadataDao before each triggered sync.
5. IF a sync triggered by a WebSocket message fails due to a network error or server error, THEN THE SyncWebSocketManager SHALL retry the sync once after a delay of 5 seconds, and if the retry also fails, SHALL not retry further until the next WebSocket message is received.

### Requirement 3: Reconnection on Failure

**User Story:** As a user, I want the WebSocket connection to automatically recover from network interruptions while I'm using the app, so that I continue receiving real-time updates without restarting the app.

#### Acceptance Criteria

1. WHEN the WebSocket connection fails or is closed unexpectedly while the SyncForegroundService is running, THE SyncWebSocketManager SHALL attempt to reconnect using exponential backoff starting at 1 second, doubling up to a maximum interval of 30 seconds, for a maximum of 10 consecutive attempts.
2. WHEN network connectivity is restored while the SyncForegroundService is running and the WebSocket is disconnected, THE SyncWebSocketManager SHALL attempt to reconnect within 1 second of detecting the connectivity change, resetting the backoff timer and attempt counter.
3. WHEN a reconnection attempt succeeds, THE SyncWebSocketManager SHALL trigger a sync within 1 second of the successful connection to catch up on any messages missed during the disconnection.
4. WHEN the SyncForegroundService is stopped (logout), THE SyncWebSocketManager SHALL cancel any pending reconnection attempts and reset the attempt counter.
5. IF the WebSocket connection fails with an authentication error (HTTP 401 during the upgrade handshake), THEN THE SyncWebSocketManager SHALL stop reconnection attempts permanently and log the authentication failure.
6. IF the maximum number of consecutive reconnection attempts (10) is reached without success, THEN THE SyncWebSocketManager SHALL stop further automatic reconnection attempts until network connectivity changes or the app returns to the foreground.
7. WHEN the app transitions to the foreground while the WebSocket is disconnected, THE SyncWebSocketManager SHALL reset the attempt counter and immediately attempt to reconnect.

### Requirement 4: Lifecycle Integration

**User Story:** As a user, I want the real-time sync to remain active even when the app UI is closed, so that alarms and timers set on other devices are delivered instantly to my phone.

#### Acceptance Criteria

1. THE AppLifecycleObserver SHALL register itself with ProcessLifecycleOwner during Application.onCreate() via Hilt dependency injection.
2. WHEN the ON_START lifecycle event fires, THE AppLifecycleObserver SHALL verify that SyncForegroundService is running and start it if it is not (in case Android killed it).
3. WHEN the ON_STOP lifecycle event fires, THE AppLifecycleObserver SHALL NOT disconnect the WebSocket or stop the SyncForegroundService — the WebSocket remains alive via the foreground service.
4. THE AppLifecycleObserver SHALL NOT cancel, pause, or modify the SyncWorker periodic work schedule — both mechanisms operate independently and the periodic sync continues regardless of lifecycle state.
5. IF the user is not authenticated (no device_token present in SharedPreferences) when ON_START fires, THEN THE AppLifecycleObserver SHALL skip starting the SyncForegroundService.
6. IF the device is offline when ON_START fires, THEN THE AppLifecycleObserver SHALL still ensure the SyncForegroundService is running, relying on the reconnection logic to connect when the network becomes available.

### Requirement 5: Coexistence with Background Sync

**User Story:** As a user, I want the existing 5-minute background sync to continue working as a fallback, so that even if the WebSocket misses a message, my data eventually catches up.

#### Acceptance Criteria

1. THE SyncWorker SHALL continue to run its 5-minute periodic sync regardless of WebSocket connection state.
2. WHEN both a WebSocket-triggered sync and a WorkManager-triggered sync attempt to run concurrently, THE SyncEngine SHALL serialize execution so that one completes before the other begins, and both produce correct results without data corruption or crashes.
3. THE SyncWebSocketManager SHALL not modify, cancel, or reschedule the existing SyncWorker periodic work.
4. WHEN both a WebSocket-triggered sync and a periodic sync fetch overlapping changes from the server, THE SyncEngine SHALL apply them idempotently via upsert so that no duplicate records are created.

### Requirement 6: Dependency Injection Integration

**User Story:** As a developer, I want the WebSocket components to be properly integrated with the existing Hilt DI graph, so that they follow the same patterns as the rest of the app.

#### Acceptance Criteria

1. THE SyncWebSocketManager SHALL be provided as a @Singleton via Hilt, receiving OkHttpClient, SharedPreferences, SyncEngine, and SyncMetadataDao as constructor dependencies.
2. THE AppLifecycleObserver SHALL be provided as a @Singleton via Hilt and SHALL receive SyncWebSocketManager as a constructor dependency.
3. THE AppLifecycleObserver SHALL be injected into CwocApplication and SHALL register with ProcessLifecycleOwner during Application.onCreate(), so that lifecycle observation is active before any Activity's onCreate() completes.
4. IF Hilt cannot satisfy a dependency required by SyncWebSocketManager or AppLifecycleObserver at graph construction time, THEN THE application SHALL fail at compile time with a missing-binding error (standard Hilt behavior — no runtime fallback required).
5. WHEN the application process is created, THE Hilt component SHALL provide exactly one instance of SyncWebSocketManager shared across all injection sites for the lifetime of the process.

### Requirement 7: Foreground Service for Persistent WebSocket

**User Story:** As a user, I want the WebSocket connection to stay alive even when the app UI is closed, so that alarms and timers set on the web are delivered to my phone instantly (not delayed by up to 5 minutes).

#### Acceptance Criteria

1. THE SyncForegroundService SHALL maintain the WebSocket connection to the server's `/ws/sync` endpoint regardless of whether the app UI is in the foreground, background, or closed.
2. WHEN the SyncForegroundService starts, THE SyncForegroundService SHALL call SyncWebSocketManager.connect() to establish the WebSocket connection.
3. WHEN the SyncForegroundService is stopped, THE SyncForegroundService SHALL call SyncWebSocketManager.disconnect() to cleanly close the WebSocket connection.
4. THE SyncForegroundService SHALL display a persistent notification on the `cwoc_sync_service` notification channel while running.
5. THE SyncForegroundService SHALL use `Service.startForeground()` with the `FOREGROUND_SERVICE_TYPE_DATA_SYNC` type to prevent Android from killing the service.
6. IF the WebSocket connection drops while the SyncForegroundService is running, THEN THE SyncWebSocketManager SHALL continue its existing exponential backoff reconnection logic (the foreground service does not interfere with reconnection behavior).
7. THE SyncForegroundService SHALL run in the same process as the main application to share the singleton SyncWebSocketManager instance.

### Requirement 8: Sync Service Notification Channel and Notification

**User Story:** As a user, I want the persistent sync notification to be silent and unobtrusive, so that it does not distract me while keeping the connection alive.

#### Acceptance Criteria

1. THE NotificationChannelManager SHALL create a notification channel with ID `cwoc_sync_service`, name "Sync Service", and importance level `IMPORTANCE_MIN` (silent, no sound, no vibration, no heads-up display).
2. THE SyncForegroundService SHALL display a notification on the `cwoc_sync_service` channel with the app icon and text "CWOC connected" (or similar brief status text).
3. THE SyncForegroundService notification SHALL use `NotificationCompat.Builder.setOngoing(true)` to prevent the user from swiping it away.
4. THE SyncForegroundService notification SHALL use priority `PRIORITY_MIN` to minimize visual presence in the notification shade.
5. WHEN the WebSocket is disconnected and reconnecting, THE SyncForegroundService SHALL update the notification text to indicate reconnecting status (e.g., "CWOC reconnecting...").
6. THE notification channel SHALL be created during app startup alongside the existing alarm, reminder, and timer channels in NotificationChannelManager.

### Requirement 9: Alarm and Timer Scheduling on Sync

**User Story:** As a user, I want alarms and timers set on the web to fire on my phone immediately after they sync, so that I never miss a time-sensitive alert regardless of which device I used to create it.

#### Acceptance Criteria

1. WHEN the SyncEngine pulls down new or modified chits that contain alert data (alarms or timers), THE NotificationScheduler SHALL schedule them via AlarmManager immediately after the sync completes.
2. THE NotificationScheduler SHALL process alerts from syncs triggered by the foreground service WebSocket path identically to syncs triggered by the WorkManager periodic path — the scheduling logic is the same regardless of sync source.
3. IF a synced chit contains an alert with a fire time in the past, THEN THE NotificationScheduler SHALL fire the notification immediately rather than silently discarding it.
4. IF a synced chit contains an alert that is already scheduled with the same parameters, THEN THE NotificationScheduler SHALL not create a duplicate alarm (idempotent scheduling).

### Requirement 10: Battery Optimization Exemption Guidance

**User Story:** As a user, I want the app to guide me through disabling battery optimization, so that Android does not kill the sync service and cause me to miss alerts.

#### Acceptance Criteria

1. WHEN the user logs in successfully and battery optimization is not already disabled for CWOC, THE application SHALL display a one-time prompt explaining that disabling battery optimization is recommended for reliable alert delivery.
2. WHEN the user accepts the battery optimization prompt, THE application SHALL launch the system `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` intent for the CWOC package.
3. IF the user dismisses the battery optimization prompt, THEN THE application SHALL record the dismissal in SharedPreferences and SHALL NOT show the prompt again.
4. THE application SHALL check battery optimization status using `PowerManager.isIgnoringBatteryOptimizations()` before showing the prompt.
5. THE battery optimization prompt SHALL only appear once per device — after the user either accepts or dismisses it, the prompt is never shown again regardless of login/logout cycles.

### Requirement 11: Foreground Service Lifecycle

**User Story:** As a user, I want the sync service to start automatically when I log in and survive app closure and device reboots, so that I always receive real-time updates without manual intervention.

#### Acceptance Criteria

1. WHEN the user logs in successfully (device_token is stored in SharedPreferences), THE application SHALL start the SyncForegroundService.
2. WHEN the user logs out (device_token is removed from SharedPreferences), THE application SHALL stop the SyncForegroundService.
3. THE SyncForegroundService SHALL continue running when the app UI is closed (removed from recents) — the service lifecycle is independent of Activity lifecycle.
4. WHEN the device completes booting (BOOT_COMPLETED broadcast received), THE BootReceiver SHALL start the SyncForegroundService if a device_token is present in SharedPreferences.
5. IF the SyncForegroundService is killed by Android (low memory or other system pressure), THEN THE service SHALL use `START_STICKY` return value from `onStartCommand()` so that Android restarts it automatically.
6. WHEN the SyncForegroundService restarts after being killed, THE SyncForegroundService SHALL re-establish the WebSocket connection using the existing connect logic (credential check, connectivity check, exponential backoff if needed).
