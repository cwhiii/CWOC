# Implementation Plan: Battery-Friendly Sync

## Overview

Replace the always-on WebSocket + 2-second HTTP polling sync mechanism with a visibility-aware lifecycle. Disconnect when the tab is hidden, reconnect with catch-up sync when visible. Server gets ping/keepalive and enhanced catch-up endpoint.

Platform scope: Web + Mobile (browser). NOT the Android app.

## Tasks

- [x] 1. Server-side: Add ping/keepalive to WebSocket endpoint and enhance catch-up sync
  - In `src/backend/routes/health.py`, add constants `SYNC_PING_INTERVAL = 30`, `SYNC_PONG_TIMEOUT = 10`, `_SYNC_MESSAGE_TTL = 300`
  - Create `_ws_ping_loop(ws)` async coroutine that sends `{"type": "__ping"}` every 30 seconds
  - Update `websocket_sync()`: spawn ping task on connect, cancel in finally block, filter `__pong` messages, use `asyncio.wait_for` for timeout detection
  - Update `_SyncHub.broadcast()` to accept optional `msg_id` param and include `__sync_id` in payload
  - Update `sync_send_message()` to pass `msg_id` to broadcast
  - Update `sync_poll()`: add time-based eviction (remove messages older than 5 min), add `missed: true` flag when `after` is older than oldest message, return `last_id: 0` when queue is empty
  - Requirements: 5, 6

- [x] 2. Frontend: Rewrite sync client with visibility-aware lifecycle
  - In `src/frontend/js/shared/shared.js`, replace the sync client section (from `// ── Sync Client` through the visibilitychange listener, before `// ── Cross-Device Auto-Refresh`) with new implementation
  - Add state variables: `_cwocSyncHiddenByVisibility`, `_cwocSyncPollFailCount`, `_cwocSyncHiddenPollInterval`, `_cwocSyncHasVisibilityAPI`
  - Implement `_syncInit()`: check Visibility API, log warning if unavailable, connect WS, register visibility listener
  - Implement `_syncConnect()`: open WS, respond to `__ping` with `__pong`, track `__sync_id` to update `_cwocSyncPollId`
  - Implement WS `onclose`: if `_cwocSyncHiddenByVisibility` is true, set mode to 'hidden' and return; otherwise retry 3x then fall back to 30s polling
  - Implement `_syncOnHidden()`: set hidden flag, close WS with code 1000, stop polling, optionally start hidden poll
  - Implement `_syncOnVisible()`: clear hidden flag, reset retries, call `_syncCatchUp()`, `_syncConnect()`, `_syncReconcileAlarms()`
  - Implement `_syncCatchUp()`: fetch `/api/sync/poll?after=lastId`, dispatch messages, handle `missed` flag, retry once on failure
  - Implement `_syncFullRefresh()`: call `_handleRemoteDataChange('chits_changed')`
  - Implement `_syncStartPolling(interval)`: use setTimeout chain at 30s interval when visible
  - Implement `_syncStopPolling()`: clear timeout
  - Implement `_syncReconcileAlarms()`: call `_sharedCheckAlarms()` immediately on tab return
  - Preserve `syncSend`, `syncOn`, `_dispatchSyncMessage` with identical APIs
  - Only register visibility listener if `_cwocSyncHasVisibilityAPI` is true
  - Requirements: 1, 2, 3, 4, 7, 8, 9

- [x] 3. Frontend: Add connection status indicator
  - Add `_syncShowDisconnected()`: create fixed-position indicator at bottom-right with parchment theme styling
  - Add `_syncHideDisconnected()`: remove the indicator element
  - Show indicator after 3 consecutive poll failures
  - Hide indicator when poll succeeds or WS connects
  - Requirements: 3.4

- [x] 4. Verify alarm/timer system integrity
  - Confirm `_sharedAlarmInterval` is NOT cleared by `_syncOnHidden()`
  - Confirm alarm globals (`_sharedChits`, `_sharedAlarmTriggered`, `_sharedSnoozeRegistry`) are not modified during disconnect/reconnect
  - Confirm `_syncReconcileAlarms()` fires missed alarms on tab return
  - Confirm catch-up sync dispatches alarm-related messages correctly
  - Requirements: 7

- [x] 5. Update documentation and version
  - Update `src/INDEX.md` with new sync functions replacing old ones
  - Update help docs if sync/connectivity documentation exists
  - Bump `src/VERSION` with current timestamp
  - Requirements: All

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3]},
    {"tasks": [4]},
    {"tasks": [5]}
  ]
}
```

Task 1 must complete first (server provides `__sync_id` and `missed` flag that the frontend depends on). Tasks 2–5 are sequential.

## Notes

- The public API (`syncSend`, `syncOn`) is unchanged — no consuming code needs modification
- The alarm system's 1-second `setInterval` is intentionally left running even when hidden (browsers throttle it, reconciliation on wake handles the gap)
- The `hiddenPollInterval` option defaults to 0 (no polling when hidden) but can be configured if a use case emerges
- This is a drop-in replacement — all existing `syncOn` handlers in `main-alerts.js` and other files continue working without changes
