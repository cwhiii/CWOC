# Requirements Document

## Introduction

This feature replaces the always-on WebSocket and aggressive HTTP polling sync mechanism in the CWOC web frontend with a battery-aware sync strategy. The goal is to minimize power consumption on laptops and mobile browsers by intelligently managing connection lifecycle based on tab visibility state, while preserving real-time sync when the user is actively viewing the page.

**Platform scope: Web + Mobile (both browser versions). NOT the Android app.**

## Glossary

- **Sync_Client**: The frontend JavaScript module responsible for managing sync connections, dispatching messages, and coordinating visibility-based lifecycle transitions
- **Sync_Server**: The FastAPI backend WebSocket endpoint (`/ws/sync`) and HTTP polling endpoint (`/api/sync/poll`) that broadcast sync messages to connected clients
- **Page_Visibility_API**: The browser `document.visibilityState` property and `visibilitychange` event used to detect whether the tab is in the foreground or background
- **Active_State**: The sync mode when `document.visibilityState === 'visible'` — real-time sync is desired
- **Hidden_State**: The sync mode when `document.visibilityState === 'hidden'` — battery conservation is prioritized
- **Catch_Up_Sync**: An immediate HTTP request to `/api/sync/poll` on tab return to visible state, fetching all messages missed while hidden
- **Ping_Interval**: A server-configured interval at which the WebSocket endpoint sends ping frames to detect dead connections
- **Polling_Interval**: The time between consecutive HTTP poll requests to `/api/sync/poll`
- **Radio_Idle**: The low-power state of a mobile device's cellular or Wi-Fi radio when no network activity occurs for a sustained period (typically 10-30 seconds of inactivity)

## Requirements

### Requirement 1: Disconnect WebSocket When Tab Is Hidden

**User Story:** As a user on a laptop or mobile browser, I want the sync connection to disconnect when I switch away from the CWOC tab, so that my device's network interface can enter a low-power state and conserve battery.

#### Acceptance Criteria

1. WHEN the Page_Visibility_API `visibilitychange` event fires and `document.visibilityState` equals `'hidden'`, THE Sync_Client SHALL close the WebSocket connection (calling `WebSocket.close()`) within 2 seconds of the event firing
2. WHILE in Hidden_State, THE Sync_Client SHALL NOT maintain an open WebSocket connection and SHALL NOT attempt to reconnect or open a new WebSocket connection
3. WHEN the WebSocket is closed due to entering Hidden_State, THE Sync_Client SHALL record the last received sync message ID (the value of `_cwocSyncPollId`) in memory before closing, so that Catch_Up_Sync can request messages with `after` set to that ID
4. WHEN the WebSocket is closed due to entering Hidden_State, THE Sync_Client SHALL close the connection with WebSocket close code 1000 (normal closure) so that the `onclose` handler does NOT trigger automatic reconnection attempts
5. IF the WebSocket connection is already closed or in a closing state when the tab enters Hidden_State, THEN THE Sync_Client SHALL take no action and SHALL NOT produce any error or user-visible output

### Requirement 2: Reconnect WebSocket When Tab Becomes Visible

**User Story:** As a user returning to the CWOC tab, I want real-time sync to resume immediately, so that I see up-to-date data without manual refresh.

#### Acceptance Criteria

1. WHEN the Page_Visibility_API reports the tab has entered Active_State, THE Sync_Client SHALL initiate a WebSocket connection to `/ws/sync` with a per-attempt connection timeout of 5 seconds
2. WHEN the tab enters Active_State, THE Sync_Client SHALL perform a Catch_Up_Sync in parallel with the WebSocket reconnection
3. WHEN the Catch_Up_Sync returns messages, THE Sync_Client SHALL dispatch all missed messages to registered handlers in ascending message ID order, discarding any message whose ID has already been processed by the WebSocket connection
4. IF the WebSocket reconnection fails after 3 attempts with a 2-second delay between each attempt, THEN THE Sync_Client SHALL fall back to HTTP polling at the Active_State Polling_Interval
5. IF the Catch_Up_Sync HTTP request fails or does not respond within 5 seconds, THEN THE Sync_Client SHALL retry the Catch_Up_Sync once, and if the retry also fails, THE Sync_Client SHALL trigger a full page data refresh to ensure consistency
6. IF the tab transitions back to Hidden_State while a reconnection sequence is in progress, THEN THE Sync_Client SHALL cancel any pending connection attempts and Catch_Up_Sync requests

### Requirement 3: Reduce HTTP Polling Frequency When Visible

**User Story:** As a user whose browser does not support WebSocket, I want the HTTP polling fallback to use a reasonable interval, so that my battery is not drained by excessive network requests.

#### Acceptance Criteria

1. WHILE in Active_State and using HTTP polling as the sync mechanism, THE Sync_Client SHALL send the next poll request 30 seconds after the previous poll response is received (measured from response completion to next request initiation)
2. WHEN the Sync_Client receives a poll response containing one or more messages, THE Sync_Client SHALL dispatch each message to all registered handlers in the chronological order returned by the server, identically to how messages were dispatched under the previous 2-second polling interval
3. IF a poll request fails due to network error or receives a non-2xx HTTP response, THEN THE Sync_Client SHALL retry the poll after 30 seconds without surfacing an error to the user (console warnings are acceptable)
4. IF 3 consecutive poll requests fail, THEN THE Sync_Client SHALL display a connection status indicator to the user and continue retrying at the 30-second interval

### Requirement 4: Stop or Minimize Polling When Tab Is Hidden

**User Story:** As a user who has backgrounded the CWOC tab, I want polling to stop or drastically reduce, so that my device can conserve battery and the cellular radio can reach Radio_Idle.

#### Acceptance Criteria

1. WHEN the document `visibilityState` changes to `'hidden'` and the Sync_Client is using HTTP polling, THE Sync_Client SHALL clear the polling timer and cease all HTTP poll requests within 0 seconds of the visibility change
2. WHEN the document `visibilityState` changes to `'hidden'` and the Sync_Client has an open WebSocket connection, THE Sync_Client SHALL close the WebSocket connection so that no keepalive frames maintain the network radio in an active state
3. WHERE the configurable option `hiddenPollInterval` is set to a value greater than 0, WHILE the document `visibilityState` is `'hidden'`, THE Sync_Client SHALL poll at that configured interval (clamped to a minimum of 60 seconds and a maximum of 3600 seconds) instead of stopping entirely
4. THE Sync_Client SHALL default `hiddenPollInterval` to 0 (no polling while hidden)
5. WHEN the document `visibilityState` changes to `'visible'`, THE Sync_Client SHALL immediately attempt to re-establish the WebSocket connection (resetting retry count to 0), and if WebSocket connection fails, SHALL fall back to HTTP polling at the Active_State Polling_Interval within 1 second of the visibility change
6. IF the document `visibilityState` changes to `'hidden'` while an HTTP poll request is in-flight, THEN THE Sync_Client SHALL allow that request to complete but SHALL not schedule any subsequent poll request (unless `hiddenPollInterval` is greater than 0)

### Requirement 5: Server-Side WebSocket Ping/Keepalive

**User Story:** As a developer, I want the server to send periodic ping frames on the WebSocket, so that dead connections are detected and cleaned up rather than lingering indefinitely.

#### Acceptance Criteria

1. THE Sync_Server SHALL send a WebSocket ping frame to each connected client at a configurable Ping_Interval, where Ping_Interval accepts values between 5 and 120 seconds
2. THE Sync_Server SHALL default the Ping_Interval to 30 seconds
3. WHEN a client completes the WebSocket handshake, THE Sync_Server SHALL start the ping cycle for that client within one Ping_Interval period
4. IF a connected client does not respond with a pong frame within 10 seconds of a ping, THEN THE Sync_Server SHALL close that client's WebSocket connection with close code 1001 (Going Away) and remove it from the broadcast list before the next ping cycle executes
5. WHEN the Sync_Server closes a connection due to missed pong, THE Sync_Server SHALL log the disconnection event including the client identifier and the timestamp of the last successful pong
6. IF the configured Ping_Interval is outside the range of 5 to 120 seconds, THEN THE Sync_Server SHALL reject the configuration and retain the previous valid Ping_Interval value

### Requirement 6: Catch-Up Sync Endpoint Enhancement

**User Story:** As a user returning to the CWOC tab after a long absence, I want to receive all missed sync messages reliably, so that my local state is consistent with the server.

#### Acceptance Criteria

1. THE Sync_Server SHALL retain sync messages in the polling queue until either 5 minutes have elapsed since the message was added or the queue exceeds 200 messages, whichever limit is reached first, evicting oldest messages first
2. WHEN the Catch_Up_Sync request includes an `after` parameter, THE Sync_Server SHALL return all messages with IDs greater than that value that are still in the queue, along with a `last_id` field indicating the most recent message ID in the queue
3. IF the requested `after` ID is older than the oldest message in the queue, THEN THE Sync_Server SHALL include a `missed: true` flag in the response indicating that some messages may have been lost
4. WHEN the Sync_Client receives a response with `missed: true`, THE Sync_Client SHALL re-fetch all displayed data from the server API (equivalent to a fresh page load data fetch) without performing a hard browser reload
5. IF the polling queue is empty when a Catch_Up_Sync request is received, THEN THE Sync_Server SHALL return an empty messages array and a `last_id` of 0 with no `missed` flag

### Requirement 7: Alarm and Timer Reliability While Backgrounded

**User Story:** As a user with active alarms or timers, I want them to still fire correctly even when the CWOC tab is backgrounded, so that I do not miss time-sensitive notifications.

#### Acceptance Criteria

1. WHILE in Hidden_State, THE Sync_Client SHALL NOT cancel, clear, or reassign any `setTimeout` or `setInterval` callbacks that belong to the alarm check system (`_sharedAlarmInterval`) or active timer countdowns
2. WHEN the tab returns to Active_State, THE Sync_Client SHALL trigger an alarm/timer reconciliation check within 1 second that compares `Date.now()` against all pending alarm/timer deadlines stored in `_sharedChits`, `_sharedIndependentAlerts`, and any active countdown timers
3. IF one or more alarm or timer deadlines have passed while the tab was in Hidden_State, THEN THE Sync_Client SHALL fire each missed alarm or timer notification individually upon returning to Active_State, skipping any deadline whose key already exists in `_sharedAlarmTriggered` (already dismissed or previously fired)
4. THE Sync_Client SHALL store pending alarm and timer deadlines in window-level variables (`_sharedChits`, `_sharedIndependentAlerts`, `_sharedSnoozeRegistry`) that are not cleared or overwritten during the WebSocket disconnect/reconnect cycle, such that a full reconnection to the sync server does not reset the local alarm state
5. IF multiple alarms or timers were missed during a single Hidden_State period, THEN THE Sync_Client SHALL fire all missed notifications in chronological order (earliest deadline first) rather than suppressing any of them

### Requirement 8: Graceful Degradation for Browsers Without Page Visibility API

**User Story:** As a user on an older browser that does not support the Page Visibility API, I want sync to still function correctly, so that the feature does not break my experience.

#### Acceptance Criteria

1. IF `document.visibilityState` is undefined at Sync_Client initialization, THEN THE Sync_Client SHALL treat the Page_Visibility_API as unavailable and SHALL NOT register a `visibilitychange` event listener
2. IF the Page_Visibility_API is not available, THEN THE Sync_Client SHALL maintain the Active_State sync behavior at all times (WebSocket connected, 30-second polling fallback)
3. IF the Page_Visibility_API is not available and the WebSocket connection drops, THEN THE Sync_Client SHALL attempt to reconnect using the same retry logic as Requirement 2 criterion 4 (3 attempts, then fall back to 30-second HTTP polling)
4. IF the Page_Visibility_API is not available, THEN THE Sync_Client SHALL log a single `console.warn` message with the prefix `[Sync]` indicating that visibility-based battery optimization is unavailable, and SHALL not repeat this warning on subsequent sync cycles

### Requirement 9: No External Dependencies

**User Story:** As a developer maintaining this vanilla JS project, I want the battery-friendly sync to be implemented without any external libraries or build tools, so that the project remains dependency-free.

#### Acceptance Criteria

1. THE Sync_Client SHALL be implemented using only vanilla JavaScript loaded via `<script>` tags in HTML files, with no ES module imports, no bundler output, and no transpilation step
2. THE Sync_Client SHALL NOT require any new external libraries, CDN resources, npm packages, or additions to the `src/static/vendor/` directory
3. THE Sync_Server SHALL be implemented using only Python standard library modules and the existing installed packages (FastAPI, uvicorn, pydantic), with no new entries added to pip requirements
4. WHEN a grep search for `import` statements is run against the new Sync_Server code, THE results SHALL reference only modules from the Python standard library or packages already imported elsewhere in `src/backend/`
5. THE Sync_Client SHALL rely only on browser-native APIs (WebSocket, fetch, Page Visibility API, setTimeout, setInterval, Notification) and SHALL NOT load any polyfill scripts
