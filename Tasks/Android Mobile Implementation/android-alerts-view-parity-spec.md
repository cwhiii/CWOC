# Android Alerts View — Full Parity Spec

## Overview

The Android Alerts view (`AlertsScreen.kt`) is completely broken. It has four mode chips (List, Independent, Notifications, Reminders) but none of them display correct content. The web mobile browser version has a fully functional alerts tab with four modes and three columns in the Independent view. This spec defines exactly what must be built to achieve full parity.

---

## Web Behavior (The Spec)

The web alerts tab has **4 modes** toggled via sidebar buttons:

| Mode | Icon | What It Shows |
|------|------|---------------|
| **Chits (list)** | 📋 | All chits that have any alert (alarm, notification, timer, stopwatch) — rendered as standard chit cards with alert summary counts |
| **Independent** | 🛎️ | Standalone alerts board — 3 columns: Alarms, Timers, Stopwatches — NOT attached to any chit |
| **Notifications** | 🔔 | Server notifications from `/api/notifications?device=mobile` — split into Unread/Addressed sections |
| **Reminders** | 📢 | Chits with `notification=true` AND `point_in_time` set — split into Upcoming/Past sections |

Default mode on web: **Independent** (stored in localStorage).

---

## Current Android State (What's Broken)

1. **AlertsScreen.kt** has FilterChip mode toggles but ALL modes render the same thing: a flat list of `ClassifiedAlert` objects parsed from chit alert JSON.
2. **AlertClassifier.kt** only handles alerts with ISO datetime strings. It cannot parse recurring alarms (`{_type: "alarm", time: "HH:MM", days: [...], enabled: true}`).
3. **No standalone alerts API integration** — `/api/standalone-alerts` is never called.
4. **No notifications API integration in alerts view** — `ProfileMenuViewModel` calls `/api/notifications` but the alerts screen doesn't use it.
5. **No reminders filtering** — doesn't filter chits by `notification + point_in_time`.
6. **No timer/stopwatch runtime** — no countdown, no elapsed time, no progress bars.
7. **No alarm card editing** — can't edit name, time, days, or toggle enabled inline.
8. **No drag-to-reorder** for independent alerts.

---

## Architecture Plan

### New Files Required

| File | Purpose |
|------|---------|
| `data/remote/CwocApiService.kt` (additions) | Add `GET/POST/PUT/DELETE /api/standalone-alerts` endpoints |
| `data/local/entity/StandaloneAlertEntity.kt` | Room entity for caching standalone alerts locally |
| `data/local/dao/StandaloneAlertDao.kt` | Room DAO for standalone alerts |
| `data/repository/StandaloneAlertRepository.kt` | Repository wrapping API + local cache |
| `ui/screens/alerts/AlertsViewModel.kt` (rewrite) | Complete rewrite to handle all 4 modes |
| `ui/screens/alerts/AlertsScreen.kt` (rewrite) | Complete rewrite of the UI |
| `ui/screens/alerts/IndependentAlertsBoard.kt` | The 3-column board composable |
| `ui/screens/alerts/IndependentAlarmCard.kt` | Alarm card with name, time picker, days, toggle, delete |
| `ui/screens/alerts/IndependentTimerCard.kt` | Timer card with duration input, countdown bar, start/pause/reset |
| `ui/screens/alerts/IndependentStopwatchCard.kt` | Stopwatch card with elapsed display, start/pause/lap/reset |
| `ui/screens/alerts/NotificationsView.kt` | Notifications mode composable |
| `ui/screens/alerts/RemindersView.kt` | Reminders mode composable |
| `ui/screens/alerts/ChitAlertsListView.kt` | Chits-with-alerts list mode composable |
| `domain/alerts/TimerRuntime.kt` | Timer countdown state management |
| `domain/alerts/StopwatchRuntime.kt` | Stopwatch elapsed state management |

### Modified Files

| File | Change |
|------|--------|
| `CwocApiService.kt` | Add standalone-alerts CRUD endpoints |
| `AppDatabase.kt` | Add StandaloneAlertEntity + DAO, bump version |
| `Migration_X_Y.kt` | New migration for standalone_alerts table |
| `AppModule.kt` | Provide StandaloneAlertRepository |

---

## Mode 1: Chits List (`list`)

### Data Source
- Query all chits from Room where `alerts IS NOT NULL AND alerts != '' AND alerts != '[]'` OR `alarm = true` OR `notification = true`
- This is the existing `getAlertChits()` DAO query (already works)

### Display
- Standard chit cards (same as other views) with:
  - Chit title (tappable → navigate to editor)
  - Alert summary row showing counts by type: `📢 N` `🔔 N` `⏱️ N` `⏲️ N`
  - Chit color applied to card background
  - Long-press → ChitActionMenu (pin/archive/snooze/edit/delete)
- Empty state: "No chits with alerts found."

### Filtering
- Respects FilterSortViewModel (tags, status, etc.)

---

## Mode 2: Independent Alerts Board (`independent`)

### Data Source
- **API**: `GET /api/standalone-alerts` → returns array of `{id, _type, name, data, created_datetime, modified_datetime}`
  - `data` is a JSON object containing the alert-specific fields
  - `_type` is one of: `"alarm"`, `"timer"`, `"stopwatch"`
- **Local cache**: `StandaloneAlertEntity` in Room for offline access
- Fetch from API on mode switch, cache locally

### Display — 3-Column Layout
Horizontal scrollable row of 3 columns (on mobile, columns stack vertically or scroll horizontally):

#### Column 1: 🔔 Alarms
Each alarm card shows:
- **Name input** — editable text field, saves on change via `PUT /api/standalone-alerts/{id}`
- **Time display** — shows formatted time (respects 12h/24h setting), tappable to open time picker
- **On/Off toggle button** — toggles `enabled` field
- **Delete button** (❌) — calls `DELETE /api/standalone-alerts/{id}`
- **Days row** — 7 day-of-week checkboxes (Sun-Sat, respecting week_start_day setting), saves on change
- **"+" button** in column header — creates new alarm with default time (current time + 1 min), today's day selected, enabled=true

Data shape per alarm:
```json
{
  "_type": "alarm",
  "name": "Morning alarm",
  "time": "07:30",
  "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "enabled": true
}
```

#### Column 2: ⏱️ Timers
Each timer card shows:
- **Name input** — editable text field
- **Loop checkbox** (🔁) — toggles `loop` field
- **Delete button** (❌)
- **Duration inputs** — HH:MM:SS number inputs (visible when timer is stopped/reset)
- **Countdown progress bar** — horizontal bar with fill percentage + time text (visible when running)
  - Bar shows remaining time as percentage of total
  - Text shows `HH:MM:SS` (or `HH:MM:SS.T` when < 10 seconds)
  - Tapping the bar pauses the timer
- **Controls**: Start/Pause button + Reset button
- **"+" button** in column header — creates new timer with 0 duration

Timer runtime state (in-memory, not persisted to server):
- `remaining` seconds (decrements every 100ms when running)
- `running` boolean
- When timer hits 0: play alarm sound, show "✓ DONE" text, if loop=true restart after 1.5s

Data shape per timer:
```json
{
  "_type": "timer",
  "name": "Cooking",
  "totalSeconds": 300,
  "loop": false
}
```

#### Column 3: ⏲️ Stopwatches
Each stopwatch card shows:
- **Name input** — editable text field
- **Delete button** (❌)
- **Elapsed time display** — `HH:MM:SS.cs` format (centiseconds), updates every 50ms when running
- **Controls**: Start/Pause button + Lap button + Reset button
- **Laps list** — shows each lap time (`Lap 1: HH:MM:SS.cs`)
- **"+" button** in column header — creates new stopwatch and auto-starts it

Stopwatch runtime state (in-memory):
- `elapsed` milliseconds
- `running` boolean
- `laps` array of formatted time strings

Data shape per stopwatch:
```json
{
  "_type": "stopwatch",
  "name": "Run"
}
```

### CRUD Operations
| Action | API Call |
|--------|----------|
| Fetch all | `GET /api/standalone-alerts` |
| Create | `POST /api/standalone-alerts` with body `{_type, name, ...fields}` |
| Update | `PUT /api/standalone-alerts/{id}` with body `{_type, name, ...fields}` |
| Delete | `DELETE /api/standalone-alerts/{id}` |

### Empty State
Per-column: "No independent {alarms/timers/stopwatches} yet."

---

## Mode 3: Notifications (`notifications`)

### Data Source
- **API**: `GET /api/notifications?device=mobile`
- Returns array of notification objects:
```json
{
  "id": "uuid",
  "chit_id": "uuid",
  "chit_title": "Task name",
  "notification_type": "assigned" | "reminder" | "shared",
  "status": "pending" | "accepted" | "declined" | "dismissed" | "snoozed",
  "owner_display_name": "John",
  "delivery_target": "mobile" | "desktop" | null,
  "created_datetime": "ISO",
  "due_datetime": "ISO" | null,
  "start_datetime": "ISO" | null
}
```

### Display
Split into two sections:

#### 📬 Unread (status = "pending")
- Sorted by `created_datetime` descending (newest first)
- Each card shows:
  - Title (tappable → navigate to editor if chit_id exists)
  - Type info: "Assigned by: {name}" or "Type: {delivery_target}"
  - Sent date
  - Due date (if present)
  - Start date (if present)
  - **Action buttons**:
    - For `notification_type == "reminder"`: Snooze button + Dismiss button
    - For sharing notifications: Accept/Decline pill toggle

#### 📭 Addressed (status != "pending")
- Sorted by `created_datetime` descending
- Same card layout but with opacity 0.7
- Shows status badge (accepted/declined/dismissed/snoozed)
- "Clear Addressed" button at section header — bulk deletes all addressed notifications
- Delete button (🗑️) on each card

### API Actions
| Action | API Call |
|--------|----------|
| Accept/Decline | `PATCH /api/notifications/{id}` body: `{status: "accepted"|"declined"}` |
| Dismiss | `PATCH /api/notifications/{id}` body: `{status: "dismissed"}` |
| Snooze | `POST /api/notifications/{id}/snooze` body: `{minutes: N}` |
| Delete | `DELETE /api/notifications/{id}` |

### Empty State
"No notifications."

---

## Mode 4: Reminders (`reminders`)

### Data Source
- Filter local chits where `notification = true` AND `point_in_time IS NOT NULL`
- Sort by `point_in_time` ascending (soonest first)

### Display
Split into two sections:

#### ⏰ Upcoming (point_in_time >= now)
Each card shows:
- **Pin button** (bookmark icon) — toggles pinned state via `PUT /api/chits/{id}`
- **Title** (tappable → navigate to editor)
- **Action buttons** (visible on card, not hover-only since mobile):
  - Complete (✓) — marks status=Complete, archived=true with undo toast
  - Archive — toggles archived state
  - Delete — soft-deletes with confirmation
- **Meta row**: `📢 {formatted date/time}`
- If past due and not complete: red "past" badge
- If complete: green "✓ done" badge

#### 📭 Past (point_in_time < now)
Same card layout, same actions.

### Empty State
"No reminders."

---

## Shared Behaviors

### Mode Persistence
- Store selected mode in SharedPreferences (key: `alerts_view_mode`)
- Default to `"independent"` (matching web default)
- Restore on screen re-entry

### Mode Toggle UI
- Row of 4 FilterChips at the top of the screen (matching current implementation but with correct icons):
  - 📋 Chits
  - 🛎️ Independent
  - 🔔 Notifs
  - 📢 Reminders

### Pull-to-Refresh
- All modes should support pull-to-refresh
- Independent mode: re-fetches from `/api/standalone-alerts`
- Notifications mode: re-fetches from `/api/notifications?device=mobile`
- Chits/Reminders modes: triggers a sync pull

### Timer/Stopwatch Lifecycle
- Timer and stopwatch runtime state lives in the ViewModel (survives configuration changes)
- When the user leaves the alerts screen, timers/stopwatches continue running in the ViewModel
- When returning to the screen, display updates resume
- Timer completion triggers a notification (via existing NotificationScheduler pattern)

### Time Format
- Respect the user's `time_format` setting (12h vs 24h) from SettingsRepository
- Apply to alarm time display and all time formatting

### Week Start Day
- Respect `week_start_day` setting for alarm day-of-week checkbox ordering

---

## API Endpoints to Add to CwocApiService.kt

```kotlin
// Standalone Alerts CRUD
@GET("/api/standalone-alerts")
suspend fun getStandaloneAlerts(): Response<List<StandaloneAlertDto>>

@POST("/api/standalone-alerts")
suspend fun createStandaloneAlert(
    @Body body: Map<String, @JvmSuppressWildcards Any?>
): Response<StandaloneAlertDto>

@PUT("/api/standalone-alerts/{id}")
suspend fun updateStandaloneAlert(
    @Path("id") id: String,
    @Body body: Map<String, @JvmSuppressWildcards Any?>
): Response<Unit>

@DELETE("/api/standalone-alerts/{id}")
suspend fun deleteStandaloneAlert(
    @Path("id") id: String
): Response<Unit>
```

### StandaloneAlertDto
```kotlin
data class StandaloneAlertDto(
    val id: String,
    val _type: String,          // "alarm", "timer", "stopwatch"
    val name: String?,
    val data: Map<String, Any?>,  // type-specific fields
    val created_datetime: String?,
    val modified_datetime: String?
)
```

---

## Room Schema Addition

### StandaloneAlertEntity
```kotlin
@Entity(tableName = "standalone_alerts")
data class StandaloneAlertEntity(
    @PrimaryKey val id: String,
    val type: String,           // "alarm", "timer", "stopwatch"
    val name: String?,
    val data: String,           // JSON string of type-specific fields
    val createdDatetime: String?,
    val modifiedDatetime: String?
)
```

### Migration
```sql
CREATE TABLE IF NOT EXISTS standalone_alerts (
    id TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT,
    data TEXT NOT NULL,
    createdDatetime TEXT,
    modifiedDatetime TEXT
)
```

---

## Task Breakdown

### Phase 1: Data Layer
1. Add `StandaloneAlertEntity` + `StandaloneAlertDao` to Room
2. Add migration for `standalone_alerts` table
3. Add standalone-alerts API endpoints to `CwocApiService.kt`
4. Create `StandaloneAlertRepository` (fetch from API, cache in Room, CRUD operations)
5. Add `StandaloneAlertDto` data class

### Phase 2: ViewModel Rewrite
6. Rewrite `AlertsViewModel` to handle all 4 modes:
   - Mode state (persisted in SharedPreferences)
   - Chits list mode: existing alert chits flow
   - Independent mode: standalone alerts from repository
   - Notifications mode: fetch from API
   - Reminders mode: filter chits with notification + point_in_time
7. Add `TimerRuntime` and `StopwatchRuntime` state management classes
8. Add timer/stopwatch lifecycle management (continue running when screen is backgrounded)

### Phase 3: UI — Independent Alerts Board
9. Build `IndependentAlertsBoard` composable (3-column layout)
10. Build `IndependentAlarmCard` (name, time picker, days, toggle, delete)
11. Build `IndependentTimerCard` (duration input, countdown bar, start/pause/reset, loop)
12. Build `IndependentStopwatchCard` (elapsed display, start/pause/lap/reset, laps list)
13. Wire up CRUD operations (create via "+" button, update on field change, delete)

### Phase 4: UI — Notifications View
14. Build `NotificationsView` composable (Unread/Addressed sections)
15. Build notification card (title, type info, dates, action buttons)
16. Wire up Accept/Decline/Snooze/Dismiss/Delete actions
17. Add "Clear Addressed" bulk action

### Phase 5: UI — Reminders View
18. Build `RemindersView` composable (Upcoming/Past sections)
19. Build reminder card (pin, title, complete/archive/delete actions, date/time, badges)
20. Wire up pin/complete/archive/delete with undo toast for complete action

### Phase 6: UI — Chits List View
21. Build `ChitAlertsListView` composable (chit cards with alert summary counts)
22. Wire up navigation to editor, long-press context menu

### Phase 7: Integration & Polish
23. Wire all modes into the rewritten `AlertsScreen`
24. Add pull-to-refresh for all modes
25. Add mode persistence (SharedPreferences)
26. Respect time_format and week_start_day settings
27. Timer completion notification integration
28. Test all modes end-to-end

---

## Acceptance Criteria

- [ ] Mode toggle shows 4 chips: 📋 Chits, 🛎️ Independent, 🔔 Notifs, 📢 Reminders
- [ ] Default mode is "Independent" (persisted across app restarts)
- [ ] **Chits mode**: Shows all chits with alerts, with type-count summary row, tappable to editor
- [ ] **Independent mode**: Shows 3-column board (Alarms, Timers, Stopwatches)
- [ ] Independent alarms: editable name, time picker, day checkboxes, on/off toggle, delete, "+" to add
- [ ] Independent timers: editable name, loop toggle, HH:MM:SS input, countdown bar, start/pause/reset, "+" to add
- [ ] Independent stopwatches: editable name, elapsed display updating at 50ms, start/pause/lap/reset, laps list, "+" to add (auto-starts)
- [ ] **Notifications mode**: Fetches from `/api/notifications?device=mobile`, shows Unread/Addressed sections
- [ ] Notification actions work: Accept/Decline for sharing, Snooze/Dismiss for reminders, Delete, Clear Addressed
- [ ] **Reminders mode**: Shows chits with notification+point_in_time, split Upcoming/Past
- [ ] Reminder actions work: Pin, Complete (with undo), Archive, Delete
- [ ] Pull-to-refresh works on all modes
- [ ] Timers continue counting down when navigating away and back
- [ ] Stopwatches continue running when navigating away and back
- [ ] Time format (12h/24h) respected everywhere
- [ ] Week start day respected in alarm day checkboxes
