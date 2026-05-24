# Technical Design: Battery-Friendly Sync

## Overview

Replace the always-on WebSocket + 2-second HTTP polling sync mechanism with a visibility-aware lifecycle that disconnects when the tab is hidden and reconnects with a catch-up sync when the tab becomes visible. This eliminates persistent network activity that drains battery on laptops and mobile browsers.

**Platform scope: Web + Mobile (both browser versions). NOT the Android app.**

## Architecture

### State Machine

The sync client operates as a finite state machine with two visibility states controlling the connection lifecycle:

```
┌─────────────────────────────────────────────────────────────┐
│                      VISIBLE (Active)                        │
│                                                             │
│  ┌──────────┐    fail x3    ┌──────────┐                   │
│  │    WS    │──────────────▶│  POLL    │                   │
│  │ Connected│◀──────────────│ (30s)    │                   │
│  └──────────┘   tab visible └──────────┘                   │
│       │              upgrade attempt                         │
└───────┼─────────────────────────────────────────────────────┘
        │ visibilitychange → hidden
        ▼
┌─────────────────────────────────────────────────────────────┐
│                      HIDDEN (Sleeping)                       │
│                                                             │
│  ┌──────────┐                                               │
│  │   IDLE   │  No WS, no polling (default)                  │
│  │          │  OR optional slow poll (≥60s) if configured    │
│  └──────────┘                                               │
│       │                                                     │
└───────┼─────────────────────────────────────────────────────┘
        │ visibilitychange → visible
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    WAKE-UP SEQUENCE                          │
│                                                             │
│  1. Catch-Up Sync (HTTP GET /api/sync/poll?after=lastId)    │
│  2. Dispatch missed messages                                │
│  3. Reconnect WebSocket                                     │
│  4. Alarm/timer reconciliation                              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend: `shared.js` — Sync Client Rewrite

The existing sync section (~140 lines) in `shared.js` will be replaced in-place. The public API (`syncSend`, `syncOn`, `_dispatchSyncMessage`) remains identical — no changes needed in consuming code.

**New state variables:**
```javascript
window._cwocSyncWs = null;
window._cwocSyncHandlers = {};          // type -> [callback, ...] (unchanged)
window._cwocSyncMode = 'none';          // 'ws' | 'poll' | 'hidden' | 'none'
window._cwocSyncPollId = 0;             // last seen message ID (used for catch-up)
window._cwocSyncPollTimer = null;       // setTimeout ID for polling
window._cwocSyncRetries = 0;            // WS reconnect attempt counter
window._cwocSyncMaxRetries = 3;         // max retries before polling fallback
window._cwocSyncHiddenByVisibility = false; // true if WS was closed due to tab hide
window._cwocSyncPollFailCount = 0;      // consecutive poll failures
window._cwocSyncHiddenPollInterval = 0; // 0 = no polling when hidden (configurable)
window._cwocSyncHasVisibilityAPI = (typeof document !== 'undefined' && typeof document.visibilityState !== 'undefined');
```

**Key functions (public interface unchanged):**

| Function | Purpose |
|----------|---------|
| `_syncInit()` | Entry point. Checks Visibility API support, connects WS, registers visibility listener |
| `_syncConnect()` | Opens WebSocket, sets up onopen/onmessage/onclose handlers |
| `_syncDisconnect(reason)` | Closes WS with code 1000 if reason is 'hidden', records lastId |
| `_syncOnVisible()` | Catch-up sync + reconnect WS + alarm reconciliation |
| `_syncOnHidden()` | Close WS, stop polling, optionally start slow hidden poll |
| `_syncStartPolling(interval)` | Start HTTP polling at given interval (30s visible, ≥60s hidden) |
| `_syncStopPolling()` | Clear poll timer |
| `_syncCatchUp()` | Fetch `/api/sync/poll?after=lastId`, dispatch messages, handle `missed` flag |
| `_syncReconcileAlarms()` | Compare Date.now() against all alarm deadlines, fire any missed |
| `_syncFullRefresh()` | Trigger full data reload via existing `_handleRemoteDataChange` |
| `_syncShowDisconnected()` | Show fixed-position "Sync disconnected" indicator |
| `_syncHideDisconnected()` | Remove the disconnected indicator |
| `syncSend(type, data)` | Send via WS if connected, else HTTP POST (unchanged API) |
| `syncOn(type, callback)` | Register handler (unchanged API) |

### Backend: `routes/health.py` — Ping/Keepalive + Catch-Up Enhancement

**New constants:**
```python
SYNC_PING_INTERVAL = 30   # seconds between pings
SYNC_PONG_TIMEOUT = 10    # seconds to wait for pong
_SYNC_MESSAGE_TTL = 300   # 5 minutes message retention
```

**Updated `_SyncHub.broadcast()` signature:**
```python
async def broadcast(self, message: dict, msg_id: int = None, exclude: WebSocket = None)
```
Includes `__sync_id` in the payload when `msg_id` is provided.

**New `_ws_ping_loop(ws)` coroutine:**
Sends `{"type": "__ping"}` every 30 seconds. If no `__pong` response within 10 seconds, the connection is closed.

**Updated `websocket_sync()` endpoint:**
Spawns ping task, filters `__pong` messages, uses `asyncio.wait_for` for timeout detection.

**Updated `sync_poll()` endpoint:**
Adds time-based eviction, `missed: true` flag, and `last_id: 0` for empty queue.

## Data Models

### Sync Message (WebSocket broadcast payload)

```json
{
  "type": "chits_changed",
  "__sync_id": 42,
  "...": "existing message fields"
}
```

The `__sync_id` field is added by the server during broadcast and stripped by the client before dispatching to handlers. It allows the client to track the last received message ID for catch-up sync.

### Sync Poll Response (enhanced)

```json
{
  "messages": [...],
  "last_id": 42,
  "missed": true
}
```

- `missed` is only present (and `true`) when the requested `after` ID is older than the oldest message in the queue
- `last_id` is `0` when the queue is empty

### Client State (window globals)

No new persistent storage. All state is in-memory window globals that reset on page reload. The `_cwocSyncPollId` is the critical piece — it tracks the last known message ID so catch-up sync knows where to resume.

## Error Handling

| Scenario | Handling |
|----------|----------|
| WS connection fails on tab visible | Retry 3 times with 2s delay, then fall back to 30s polling |
| Catch-up sync HTTP request fails | Retry once after 1s, then trigger full page data refresh |
| 3 consecutive poll failures | Show "Sync disconnected" indicator, continue retrying at 30s |
| Server restart while tab hidden | Catch-up sync returns `missed: true` → full data refresh |
| Messages evicted (>5 min hidden) | `missed: true` flag → full data refresh |
| Rapid tab switching (<1s) | Check WS state before opening new connection; cancel pending reconnects on re-hide |
| Tab hidden during reconnect sequence | Cancel pending connection attempts, enter hidden mode |
| Browser without Visibility API | Stay in always-active mode (WS + 30s polling fallback), log single warning |

## Correctness Properties

### Property 1: No Message Loss
Every sync message is either received via WebSocket in real-time OR retrieved via catch-up sync on tab return. If messages were evicted from the server queue (>5 min), the `missed` flag triggers a full data refresh ensuring consistency.

**Validates: Requirements 2.3, 6.3, 6.4**

### Property 2: No Duplicate Dispatch
The client tracks `_cwocSyncPollId` and discards any message with an ID ≤ the last processed ID. Messages received via both catch-up sync and a newly-connected WebSocket are deduplicated by ID.

**Validates: Requirements 2.3, 1.3**

### Property 3: Alarm Reliability
The alarm check interval (`_sharedAlarmInterval`) is never cleared by the sync lifecycle. On tab return, an immediate reconciliation check via `_sharedCheckAlarms()` fires any alarms whose deadline passed while the tab was hidden.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 4: Battery Conservation
In hidden state, zero network activity occurs (default `hiddenPollInterval = 0`). The network interface and cellular/Wi-Fi radio can enter their deepest sleep states within seconds of the tab being hidden.

**Validates: Requirements 1.1, 1.2, 4.1, 4.4**

### Property 5: Graceful Degradation
Without Visibility API, behavior is identical to the new "always visible" mode (WS + 30s polling) — still a 15x improvement over the current 2s polling fallback.

**Validates: Requirements 8.1, 8.2, 8.3**

## Testing Strategy

Manual testing (no automated test framework required):

1. **Basic lifecycle**: Open CWOC, switch to another tab for 30s, switch back. Verify WS reconnects and any changes made on another device appear.
2. **Long absence**: Hide tab for >5 minutes, make changes on another device. Verify `missed` flag triggers full refresh on return.
3. **Alarm while hidden**: Set an alarm for 1 minute in the future, hide the tab. Return after 2 minutes. Verify alarm fires immediately.
4. **Network loss**: Disconnect network while tab is visible. Verify "Sync disconnected" indicator appears after ~90s (3 failed polls). Reconnect network, verify indicator disappears.
5. **Polling fallback**: Block WebSocket (e.g., via browser devtools network throttling). Verify polling starts at 30s interval, not 2s.
6. **Mobile browser**: Open CWOC on phone browser, switch to another app, return. Verify sync resumes cleanly.

## Files Modified

| File | Change |
|------|--------|
| `src/frontend/js/shared/shared.js` | Replace sync client section (~lines 2279–2430) with visibility-aware implementation |
| `src/backend/routes/health.py` | Add ping loop, update `websocket_sync`, enhance `sync_poll` with TTL + `missed` flag, update `broadcast` to include `__sync_id` |
| `src/INDEX.md` | Update function listings for sync section |
| `src/VERSION` | Bump version |
