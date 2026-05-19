# Alerts (All 4 Sub-Modes)

**Category:** Dashboard Views
**Item #:** 13
**Code Verified:** ✅
**User Verified:** ⬜

## Source Files
- `src/frontend/js/dashboard/main-views-alarms.js` — Alarms view + Independent Alerts board + Notifications + Reminders
- `src/frontend/js/dashboard/main-alerts.js` — Global alert system (alarm checking, modals, audio, browser notifications)
- `src/frontend/js/dashboard/main-views.js` — `_restoreViewModeButtons`, `filterChits`

---

## Mode Toggle

- [ ] `_alarmsViewMode` — state variable: `'independent'` (default), `'list'`, `'notifications'`, `'reminders'`
- [ ] Persisted to `localStorage('cwoc_alarmsViewMode')`
- [ ] `_setAlarmsMode(mode)` — switches between modes
  - [ ] Updates URL hash via `_updateUrlHash()`
  - [ ] Updates 4 button highlight styles (ivory background for active)
  - [ ] Pre-fetches independent alerts when switching to 'independent'
  - [ ] Calls `displayChits()` to re-render
- [ ] `_restoreViewModeButtons()` — restores button highlights
  - [ ] `#alarms-mode-list` button
  - [ ] `#alarms-mode-independent` button
  - [ ] `#alarms-mode-notifications` button
  - [ ] `#alarms-mode-reminders` button

---

## Sub-Mode 1: Independent Alerts Board

### Entry Point
- [ ] `_displayIndependentAlertsBoard()` — renders 3-column board (Alarms, Timers, Stopwatches)

### Board Layout
- [ ] Wrapper with class `independent-alerts-board`
- [ ] 3 columns: Alarm (🔔), Timer (⏱️), Stopwatch (⏲️)
- [ ] Each column: class `sa-column`, `dataset.saType`

### Column Header
- [ ] Icon + label text
- [ ] "+" add button (`sa-add-btn`) — calls `_addIndependentAlert(type)`

### Card Ordering
- [ ] Saved order restored from `localStorage('cwoc_sa_order_' + type)`
- [ ] Cards sorted by saved order, new cards appended at end

### Independent Alerts CRUD
- [ ] `_fetchIndependentAlerts()` — `GET /api/standalone-alerts`
- [ ] `_createIndependentAlert(alertData)` — `POST /api/standalone-alerts`
- [ ] `_updateIndependentAlert(id, alertData)` — `PUT /api/standalone-alerts/${id}`
- [ ] `_deleteIndependentAlert(id)` — `DELETE /api/standalone-alerts/${id}`
  - [ ] Cleans up timer/stopwatch runtime state
  - [ ] Syncs via `syncSend('alerts_changed', {})`

### Add Independent Alert — `_addIndependentAlert(type)`
- [ ] Alarm: creates with default time (now + 1 min), current day, enabled
- [ ] Timer: creates with `totalSeconds: 0`, `loop: false`
- [ ] Stopwatch: creates and auto-starts immediately

### Card Builder — `_buildIndependentCard(id, type, data)`
- [ ] Routes to `_buildSaAlarmCard`, `_buildSaTimerCard`, or `_buildSaStopwatchCard`
- [ ] Card class `sa-card`, `dataset.alertId`

---

### Alarm Card — `_buildSaAlarmCard`

- [ ] Uses shared `cwocBuildAlarmCard()` component
- [ ] Name input — editable, saves on change
- [ ] Time input — editable, saves on change (auto-adds current day if no days set)
- [ ] Day selector — 7 day buttons (Sun-Sat), toggle on/off
- [ ] Enable/disable toggle
  - [ ] Disabling cancels any active snooze
- [ ] Delete button (❌)
- [ ] Snooze countdown bar (when snoozed)
  - [ ] Shows remaining time
  - [ ] Restart button
  - [ ] Dismiss button
- [ ] Snooze state synced via `_persistSnooze` / `_persistDismiss`
- [ ] WebSocket sync: `syncSend('alerts_changed', {})`

---

### Timer Card — `_buildSaTimerCard`

- [ ] Runtime state: `_saTimerRuntime[id]` — `{ remaining, intervalId, running }`
- [ ] Name input — editable, saves on change
- [ ] Loop checkbox (🔁) — saves on change
- [ ] Delete button (❌)

#### Input Mode (when not running)
- [ ] HH:MM:SS number inputs (`sa-dur-input` class)
- [ ] Change event updates `data.totalSeconds` and saves

#### Countdown Mode (when running)
- [ ] Progress bar (`sa-timer-bar`) with fill and text overlay
- [ ] 100ms tick interval for precision (tenths of seconds below 10s)
- [ ] Bar fill width = `(remaining / total) * 100%`
- [ ] Click on countdown bar: pauses timer

#### Controls
- [ ] ▶ Start / ⏸ Pause button
  - [ ] Start: switches to bar mode, starts countdown
  - [ ] Registers with server: `POST /api/timer-state`
  - [ ] Syncs: `syncSend('timer_started', { alertId, totalSeconds, endTs, name })`
  - [ ] Pause: stops interval, syncs `timer_paused`
  - [ ] Cancels server timer: `DELETE /api/timer-state`
- [ ] 🔄 Reset button
  - [ ] Resets to `data.totalSeconds`, switches to input mode
  - [ ] Syncs: `syncSend('timer_reset', { alertId })`
  - [ ] Cancels server timer

#### Timer Completion
- [ ] Plays timer audio via `_globalPlayTimer()`
- [ ] Shows "✓ DONE" in bar
- [ ] Shows timer done modal via `_showTimerDoneModal(name, callback)`
- [ ] Syncs: `syncSend('timer_fired', { timerName, alertId })`
- [ ] If loop enabled: auto-restarts after 1.5s
- [ ] If not loop: switches back to input mode after 2.5s

---

### Stopwatch Card — `_buildSaStopwatchCard`

- [ ] Runtime state: `_saSwRuntime[id]` — `{ running, elapsed, intervalId, laps }`
- [ ] Name input — editable, saves on change
- [ ] Delete button (❌)
- [ ] Display: `HH:MM:SS.cc` format (centiseconds)
- [ ] `_saSwFmt(ms)` — formats milliseconds to display string

#### Controls
- [ ] ▶ Start / ⏸ Pause button
  - [ ] Start: 50ms interval, tracks elapsed from `Date.now() - elapsed`
  - [ ] Pause: clears interval
- [ ] 🏁 Lap button (only when running)
  - [ ] Adds current elapsed time to `rt.laps` array
  - [ ] Re-renders laps display
- [ ] 🔄 Reset button
  - [ ] Clears interval, resets elapsed to 0, clears laps

#### Laps Display — `_renderSaLaps`
- [ ] Shows each lap: "Lap N: HH:MM:SS.cc"
- [ ] Monospace font, 0.8em, 0.7 opacity

---

### Drag-to-Reorder (Independent Cards)

#### HTML5 Desktop Drag
- [ ] `dragstart`: adds `cwoc-dragging` class
- [ ] `dragover`: shows border indicator (top/bottom)
- [ ] `drop`: reorders in DOM, saves order to localStorage
- [ ] `dragend`: removes dragging class

#### Touch Mobile Drag
- [ ] `enableTouchGesture` on each card
- [ ] `onDragStart`: adds dragging class
- [ ] `onDragMove`: shows border indicators via `elementFromPoint`
- [ ] `onDragEnd`: reorders in DOM, saves to localStorage

---

## Sub-Mode 2: List View — `displayAlarmsView`

### Filtering
- [ ] Includes chits with `alerts` array entries, or `alarm`/`notification` flags

### Card Rendering (per chit)
- [ ] Class `chit-card`, `draggable = true`, `dataset.chitId`
- [ ] `applyChitColors()`, `archived-chit` class, `declined-chit` class
- [ ] Standard `_buildChitHeader()` with title as link to editor

### Alert Summary Row
- [ ] 📢 notification count
- [ ] 🔔 alarm count
- [ ] ⏱️ timer count
- [ ] ⏲️ stopwatch count

### Interactions
- [ ] Double-click: navigates to editor
- [ ] Shift+click: opens quick-edit modal
- [ ] Right-click: opens context menu
- [ ] Drag-to-reorder via `enableDragToReorder(view, 'Alarms', callback, longPressMap)`

---

## Sub-Mode 3: Notifications View — `_displayNotificationsView`

### Data Fetching
- [ ] `GET /api/notifications?device=mobile|desktop`
- [ ] Clears profile notification badge
- [ ] Clears sidebar notification badge

### Sections
- [ ] 📬 Unread (pending) — sorted most recent first
- [ ] 📭 Addressed (non-pending) — sorted most recent first
  - [ ] "Clear Addressed" button → `_clearAddressedNotifsInView()`

### Notification Card — `_buildNotifCard(notif, isUnread)`
- [ ] Title (link to editor for sharing notifications, plain text for reminders)
- [ ] Type info: "Assigned by: name" or "From: name" or delivery target
- [ ] Sent date
- [ ] Due date (if present)
- [ ] Start date (if present)
- [ ] Status badge for addressed items

#### Action Buttons (Sharing Notifications)
- [ ] Accept/Decline pill toggle
- [ ] `_respondNotifInView(notifId, 'accepted'|'declined')` — `PATCH /api/notifications/${id}`

#### Action Buttons (Reminder Notifications)
- [ ] Snooze button (configurable minutes) → `_snoozeNotifInView(notifId, minutes)`
  - [ ] `POST /api/notifications/${id}/snooze`
- [ ] Dismiss button → `_dismissNotifInView(notifId)`
  - [ ] `PATCH /api/notifications/${id}` with `{ status: 'dismissed' }`

#### Common Actions
- [ ] 🗑️ Delete button → `_deleteNotifInView(notifId)`
  - [ ] `DELETE /api/notifications/${id}`
- [ ] Double-click: navigates to chit editor

### Post-Action Refresh
- [ ] Re-renders notifications view
- [ ] Calls `_fetchNotifications()` (sidebar badge)
- [ ] Calls `_fetchProfileNotifications()` (profile badge)

---

## Sub-Mode 4: Reminders View — `_displayRemindersView`

### Filtering
- [ ] Chits with `notification` flag AND `point_in_time` (Quick Reminder chits)
- [ ] Sorted by `point_in_time` ascending (soonest first)

### Sections
- [ ] ⏰ Upcoming (point_in_time >= now)
- [ ] 📭 Past (point_in_time < now)

### Reminder Card — `_buildReminderCard(chit)`
- [ ] Card with `chit-card reminder-card` class
- [ ] `applyChitColors()`, `archived-chit` class
- [ ] Opacity 0.6 for Complete status

#### Top Row
- [ ] Pin button (bookmark icon) — toggles `pinned` via `PUT /api/chits/${id}`
- [ ] Title link — navigates to editor
- [ ] Hover-visible action buttons:
  - [ ] Status toggle (✓ Complete / ↩ Undo)
    - [ ] Complete: undo countdown toast, then `PUT` with `{ status: 'Complete', archived: true }`
    - [ ] Undo: reverts to `{ status: null, archived: false }`
  - [ ] Archive button — toggles `archived`
  - [ ] Delete button — confirmation via `cwocConfirm`, then soft-delete

#### Meta Row
- [ ] 📢 formatted date/time of `point_in_time`
- [ ] "past" badge (red) if overdue and not complete
- [ ] "✓ done" badge (green) if status is Complete

#### Interactions
- [ ] Double-click: navigates to editor
- [ ] Shift+click: opens quick-edit modal
- [ ] Right-click: opens context menu

---

## Global Alert System — `main-alerts.js`

### State
- [ ] `_globalTriggeredAlarms` — Set of fired alarm keys (prevents re-fire)
- [ ] `_globalFiredNotifications` — Set of fired notification keys
- [ ] `_globalAlarmInterval` / `_globalNotifInterval` — check intervals
- [ ] `_globalAlarmAudio` / `_globalTimerAudio` — Audio elements
- [ ] `_globalTimeFormat` — "24hour" or "12hour" or "12houranalog"
- [ ] `_snoozeRegistry` — object mapping snoozeKey → untilTs

### Startup — `_startGlobalAlertSystem()`
- [ ] Requests browser notification permission
- [ ] Loads snooze length from settings
- [ ] Loads time format from settings
- [ ] Loads persisted dismiss/snooze states via `_loadAlertStates()`
- [ ] Starts notification checker (30s interval)
- [ ] WebSocket sync listeners:
  - [ ] `alert_snoozed` — updates snooze registry, re-renders
  - [ ] `timer_started` — starts local countdown from endTs
  - [ ] `timer_paused` — pauses local timer
  - [ ] `timer_reset` — resets local timer
  - [ ] `alerts_changed` — re-fetches independent alerts
  - [ ] `chits_changed` — re-fetches chits
- [ ] Periodic re-fetch of independent alerts (30s safety net)

### Alert State Persistence
- [ ] `_loadAlertStates()` — `GET /api/alert-state`
- [ ] `_persistDismiss(alertKey)` — `POST /api/alert-state` with `{ state: 'dismissed' }`
- [ ] `_persistSnooze(snoozeKey, untilTs)` — `POST /api/alert-state` with `{ state: 'snoozed', until_ts }`

### Alarm Checking — `_globalCheckAlarms()`
- [ ] Runs on interval (handled by shared.js)
- [ ] Checks chit-based alarms: matches current time + day
- [ ] Checks independent alarms: same logic
- [ ] Checks expired snoozes: re-fires alarms whose snooze ran out
- [ ] Skips if already triggered (key in `_globalTriggeredAlarms`)
- [ ] Skips if snoozed (key in `_snoozeRegistry` and not expired)
- [ ] Cleans up old keys (different date)
- [ ] Delete Past Alarm Chits: auto-archives alarm-only chits whose time passed (if setting enabled)

### Notification Checking — `_globalCheckNotifications()`
- [ ] Checks chit notification alerts (time-based: before/after start/due)
- [ ] "Only if undone" logic: skips if habit goal met or chit complete
- [ ] Supports `targetType`: "start", "due", "cycle" (habit cycle end)
- [ ] Weather notifications via `_globalCheckWeatherNotification()`
  - [ ] Conditions: high_above, high_below, low_above, low_below, precipitation, rain, snow, hail, wind_above
  - [ ] Respects metric/imperial unit conversion
  - [ ] Fires once per chit per day

### Audio Playback
- [ ] `_globalPlayAlarm()` — plays `/static/alarm.mp3` on loop, auto-stops after 5 min
- [ ] `_globalStopAlarm()` — stops alarm audio, clears timeout, stops vibration
- [ ] `_globalPlayTimer()` — plays `/static/timer.mp3` on loop
- [ ] `_globalStopTimer()` — stops timer audio

### Alert Modal — `_showAlertModal(opts)`
- [ ] Full-screen overlay with class `cwoc-alert-overlay`
- [ ] Locks body scroll (`overflow: hidden`, `touch-action: none`)
- [ ] Blocks all scroll/touch events on overlay
- [ ] Pulsing progress bar at top
- [ ] Large icon (🔔 or ⏱️)
- [ ] Title and subtitle text
- [ ] Buttons:
  - [ ] 📝 Open Chit (if chitId provided) — navigates to editor
  - [ ] ✕ Dismiss — stops all sounds, persists dismiss, syncs
  - [ ] Snooze row (if showSnooze): H/D/W/F/M circular buttons
    - [ ] Each snooze: stops sounds, persists snooze, shows undo toast, re-renders
- [ ] ESC key: dismisses (with `stopImmediatePropagation`)
- [ ] Blocks all other keyboard shortcuts while open
- [ ] Animation: `active` class added after reflow

### Dismiss Modal — `_dismissAlertModal(overlay, onDismiss)`
- [ ] Removes `active` class (triggers exit animation)
- [ ] Removes keyboard blocker
- [ ] Unlocks body scroll (only if no other alert modals open)
- [ ] Removes overlay after 300ms delay

### Timer Done Modal — `_showTimerDoneModal(timerName, onDismiss)`
- [ ] Shows alert modal with ⏱️ icon, "Time's up!" subtitle
- [ ] No snooze option
- [ ] Syncs `timer_dismissed` on dismiss

### Browser Notifications — `_sendBrowserNotification(title, body, chitId, playSound)`
- [ ] Checks `Notification.permission === 'granted'`
- [ ] Creates notification with icon, tag, renotify, requireInteraction
- [ ] Vibrate pattern: `[200, 100, 200, 100, 300]`
- [ ] Click handler: focuses window, navigates to editor or Alarms tab
- [ ] Fallback: service worker notification for Android browsers

### Toast Notifications — `_showGlobalToast(emoji, label, chitTitle, chitId, onDismiss)`
- [ ] Alarms (🔔): delegates to `_showAlertModal`
- [ ] Notifications (📢): compact fixed-position toast
  - [ ] Title row, label row, button row (Open + Dismiss)
  - [ ] Auto-removes after 60 seconds

### Helpers
- [ ] `_globalFmtTime(time24)` — formats time based on `_globalTimeFormat`
- [ ] `_globalDayAbbr(date)` — returns 3-letter day abbreviation
- [ ] `_getSnoozeMs()` — parses snooze length setting to milliseconds
- [ ] `_globalGetHabitCycleEnd(chit)` — calculates habit cycle end datetime
