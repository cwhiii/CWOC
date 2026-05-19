# Alerts

**Category:** Editor Zones
**Item #:** 24
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Alerts Zone Structure (editor.html)

- [ ] `<div id="alertsSection" class="zone-container">` — Alerts zone container
- [ ] `<div id="alertsContent" class="zone-body">` — Alerts zone body (collapsible)
- [ ] Zone header with `toggleZone(event, 'alertsSection', 'alertsContent')` — Expand/collapse

### Alerts Zone Header Buttons (editor.html)

- [ ] Add Alarm button (`onclick="openAlarmModal(event)"`) — Adds a new alarm inline
- [ ] Add Timer button (`onclick="openTimerModal(event)"`) — Adds a new timer inline
- [ ] Add Stopwatch button (`onclick="addStopwatch(event)"`) — Adds a new stopwatch inline
- [ ] Add Notification button (`onclick="openNotificationModal(event)"`) — Adds a new notification inline

### Alert Containers (editor.html)

- [ ] `<div id="notifications-container">` — Notifications list container
- [ ] `<div id="alarms-container">` — Alarms list container
- [ ] `<div id="timers-container">` — Timers list container
- [ ] `<div id="stopwatches-container">` — Stopwatches list container

### Master Render (editor-alerts.js)

- [ ] `renderAllAlerts()` — Renders all four alert type containers
- [ ] `_alertsFromChit(chit)` — Loads alerts from chit data, categorizes by `_type`, renders all
- [ ] `_alertsToArray()` — Converts alert data back to flat array for save (filters incomplete notifications)
- [ ] `window._alertsData` — Master alert state: `{alarms: [], timers: [], stopwatches: [], notifications: []}`

### Time Format (editor-alerts.js)

- [ ] `_loadEditorTimeFormat()` — Loads time format from settings (12hour/24hour)
- [ ] `_fmtAlarmTime(time24)` — Formats alarm time for display (respects 12/24 hour setting)
- [ ] `window._editorTimeFormat` — Current time format setting

---

## Alarms

### Alarm CRUD (editor-alerts.js)

- [ ] `openAlarmModal(event)` — Adds new alarm inline (default: now+1min, today's day)
- [ ] `editAlarmItem(idx)` — Opens alarm edit modal for existing alarm
- [ ] `addAlarm()` — Saves alarm from modal inputs
- [ ] `toggleAlarmEnabled(idx)` — Toggles alarm enabled/disabled (cancels snooze if disabling)
- [ ] `deleteAlarmItem(idx)` — Deletes alarm by index
- [ ] `closeAlarmModal(save)` — Closes alarm modal

### Alarm Rendering (editor-alerts.js)

- [ ] `renderAlarmsContainer()` — Renders all alarm cards using `cwocBuildAlarmCard()`
- [ ] Each alarm card supports:
  - [ ] Name input (editable)
  - [ ] Time input (editable)
  - [ ] Day-of-week selection (Mon-Sun checkboxes)
  - [ ] Enable/disable toggle
  - [ ] Delete button
  - [ ] Delete-after-dismiss checkbox
  - [ ] Snooze controls (restart, dismiss)

### Alarm Checker (editor-alerts.js)

- [ ] `_startAlarmChecker()` — Starts 1-second interval to check alarms
- [ ] `_stopAlarmChecker()` — Stops alarm checker interval
- [ ] `_checkAlarms()` — Checks all alarms against current time and day
- [ ] `_triggeredAlarms` — Set of triggered alarm keys (prevents re-firing)
- [ ] `_dayAbbr(date)` — Returns day abbreviation (Sun/Mon/Tue/Wed/Thu/Fri/Sat)
- [ ] Fires browser Notification when alarm triggers
- [ ] `_showAlarmAlert(alarm, onDismiss)` — Shows non-blocking overlay alert with Dismiss and Snooze buttons
- [ ] Snooze adds 5 minutes to alarm time
- [ ] Delete-after-dismiss: deletes chit via API after dismissal

### Alarm Sound (editor-alerts.js)

- [ ] `_playAlarmSound()` — Plays alarm.mp3 on loop
- [ ] `_stopAlarmSound()` — Stops alarm audio
- [ ] `_alarmAudio` — Audio element for alarm sound

---

## Timers

### Timer CRUD (editor-alerts.js)

- [ ] `openTimerModal(event)` — Adds new timer inline (default: 0 seconds)
- [ ] `editTimerItem(idx)` — Opens timer edit modal
- [ ] `addTimer()` — Saves timer from modal inputs
- [ ] `deleteTimerItem(idx)` — Deletes timer, clears interval, rebuilds runtime map
- [ ] `closeTimerModal(save)` — Closes timer modal

### Timer Rendering (editor-alerts.js)

- [ ] `renderTimersContainer()` — Renders all timer cards with:
  - [ ] Name input (editable)
  - [ ] Loop checkbox (🔁)
  - [ ] Delete button (❌)
  - [ ] Duration input mode: HH:MM:SS number inputs
  - [ ] Countdown mode: progress bar (HST-style gradient fill)
  - [ ] Start/Pause button (▶ Start / ⏸ Pause)
  - [ ] Reset button (🔄 Reset)
- [ ] Click on countdown bar → pauses timer and shows input mode

### Timer Runtime (editor-alerts.js)

- [ ] `window._timerRuntime` — Runtime state: `{remaining, intervalId, running}` per timer
- [ ] Timer ticks at 100ms intervals (shows tenths of seconds in last 10 seconds)
- [ ] On completion: plays timer sound, shows "✓ DONE", fires shared alert modal
- [ ] Loop mode: auto-restarts after 1.5 seconds
- [ ] Non-loop: returns to input mode after 2.5 seconds
- [ ] Server-side timer tracking: POST/DELETE to `/api/timer-state` for Ntfy notifications
- [ ] `syncSend('timer_fired', ...)` — Syncs timer completion to other devices

### Timer Sound (editor-alerts.js)

- [ ] `_playTimerSound()` — Plays timer.mp3 on loop
- [ ] `_timerAudio` — Audio element for timer sound

---

## Stopwatches

### Stopwatch CRUD (editor-alerts.js)

- [ ] `addStopwatch(event)` — Adds new stopwatch inline
- [ ] `deleteStopwatchItem(idx)` — Deletes stopwatch, clears interval, rebuilds runtime
- [ ] `closeStopwatchModal()` — Closes stopwatch modal
- [ ] `saveStopwatchDetails()` — Saves stopwatch name from modal

### Stopwatch Rendering (editor-alerts.js)

- [ ] `renderStopwatchesContainer()` — Renders all stopwatch cards with:
  - [ ] Name input (editable)
  - [ ] Delete button (❌)
  - [ ] Time display (HH:MM:SS.cc format, monospace)
  - [ ] Start/Pause button (▶ Start / ⏸ Pause)
  - [ ] Lap button (🏁 Lap)
  - [ ] Reset button (🔄 Reset)
  - [ ] Laps list (scrollable, max 80px height)
- [ ] `renderLaps(idx, container)` — Renders lap times list
- [ ] `_swFmt(ms)` — Formats milliseconds to HH:MM:SS.cc

### Stopwatch Runtime (editor-alerts.js)

- [ ] `window._swRuntime` — Runtime state: `{running, elapsed, intervalId, laps}` per stopwatch
- [ ] Stopwatch ticks at 50ms intervals
- [ ] Lap records current elapsed time
- [ ] Reset clears elapsed, laps, and stops interval

---

## Notifications

### Notification CRUD (editor-alerts.js)

- [ ] `openNotificationModal(event)` — Adds new notification with "unset" direction
- [ ] `addNotification()` — Saves notification from modal inputs (legacy)
- [ ] `deleteNotificationItem(idx)` — Deletes notification by index
- [ ] `closeNotificationModal(save)` — Closes notification modal
- [ ] `validateNotificationInputs()` — Validates notification value input

### Notification Rendering (editor-alerts.js)

- [ ] `renderNotificationsContainer()` — Renders all notification rows with:
  - [ ] Direction dropdown (Choose/At/Before/After/Desktop/Weather/Habit)
  - [ ] Value input (number)
  - [ ] Unit dropdown (minutes/hours/days/weeks)
  - [ ] Target dropdown or label (start/end/due/point)
  - [ ] Delete button (❌ or ✅ for triggered)
  - [ ] "Disable if done" checkbox (habit mode)
  - [ ] Progressive disclosure: controls appear as direction is chosen

### Notification Directions (editor-alerts.js)

- [ ] `"unset"` — Placeholder, no notification configured yet (highlighted gold border)
- [ ] `"at"` — At the target time (value=0)
- [ ] `"before"` — Before the target time
- [ ] `"after"` — After the target time
- [ ] `"desktop"` — Next time on desktop (no time dependency)
- [ ] `"weather"` — Weather condition-based notification
- [ ] `"habit"` — Habit will be missed within X time

### Weather Notifications (editor-alerts.js)

- [ ] `_appendWeatherControls(row, n, idx)` — Appends weather condition controls to row
- [ ] Weather condition dropdown: high above, high below, low above, low below, any precipitation, rain, snow, hail, wind over
- [ ] Precipitation mode dropdown: any amount / more than X
- [ ] Threshold input (temperature in display units, stored in °C canonical)
- [ ] Wind threshold input (in display units, stored in km/h canonical)
- [ ] Precipitation threshold input (in display units, stored in mm canonical)
- [ ] Current forecast hint text (shows actual forecast values)
- [ ] `_checkWeatherNotification(n, idx, title)` — Checks weather condition against stored forecast
- [ ] `_weatherCodeToPrecipType(code)` — Maps WMO code to precipitation type string
- [ ] `_getWindMax(wd)` — Gets higher of wind_gusts and wind_speed

### Notification Checker (editor-alerts.js)

- [ ] `_startNotificationChecker()` — Starts 30-second interval to check notifications
- [ ] `_stopNotificationChecker()` — Stops notification checker
- [ ] `_checkNotificationAlerts()` — Checks all notifications against current time
- [ ] `_firedNotifications` — Set of fired notification keys (prevents re-firing)
- [ ] `_fireNotificationAlert(msg, notif, notifIdx)` — Fires browser notification + inline toast
- [ ] Toast auto-dismisses after 8 seconds, has Dismiss button
- [ ] Habit notifications skip if goal already met (`only_if_undone`)

### Default Notifications (editor-alerts.js)

- [ ] `_applyDefaultNotifications(mode)` — Auto-populates notifications from settings for new chits
- [ ] Only applies once per date mode per session
- [ ] Expands alerts zone when notifications are added
- [ ] `_defaultNotifsApplied` — Tracks which modes have had defaults applied

### Notification Helpers (editor-alerts.js)

- [ ] `_notifTimingLabel(n)` — Builds human-readable timing label
- [ ] `_notifTargetLabel()` — Returns "start", "due", or "start/due" based on date fields
- [ ] `_defaultTargetForMode(dateMode)` — Returns default target type for a date mode
- [ ] `_habitPeriodLabel()` — Returns human label for habit cycle (day/week/month/year)
- [ ] `_getHabitCycleEnd()` — Calculates end-of-cycle datetime for current habit period
