- Added New Chit Zone Prefill (auto-opens relevant zones based on C CAPTN view)
- Fixed editor zone color background on Android
- Fixed recurring Settings save/logout bug
- Fixed week_start_day cross-platform format mismatch

## s20260521.2104 / m20260521.2104

Fixed recurring Settings "Save & Exit" logout bug: the sync push was blocking the save flow, so a transient server DB lock (returning 401 instead of 503) would trigger the TokenAuthenticator and log the user out. Fix: (1) push is now fire-and-forget so save completes immediately, (2) server returns 503 on DB errors instead of false 401, (3) TokenAuthenticator verifies token still exists before triggering logout.

## s20260521.2057 / m20260521.2057

Existing chits now open to the Overview zone on mobile web and Android app (previously defaulted to Dates zone). Session-saved zone is still restored on mobile web refresh.

## m20260521.2056

Fixed Android app "Week Start Day" setting: now shows all 7 days (Sun–Sat) matching the web, uses the same numeric format ("0"–"6") for cross-platform consistency, and correctly displays the value set on any platform instead of showing raw "0" or mismatched text.

## s20260521.1936 / m20260521.1936

New Chit Zone Prefill: when creating a new chit, the editor now pre-opens zones and auto-focuses fields based on which C CAPTN view the user was in. Tasks opens Task+Dates zones with due date highlighted, Projects opens Projects+Checklist, Notes focuses the notes textarea, Checklists focuses the first checklist input. Works across web desktop, mobile web (zone-at-a-time), and Android app (with sourceTab nav argument wired through FAB).

## m20260521.1821

Fixed Android editor zone content area not showing the chit's color as background. The mobile web editor applies the chit's color to the entire editor container, but the Android app was only applying it to the nav header bar. Now the zone content area background matches the chit's color (or defaults to parchment when no color is set), matching mobile web behavior exactly.

## m20260521.1849

Fixed 24-hour time format not being respected anywhere in the Android app. The server stores the setting as `"24hour"` but the app was checking for `"24h"` or `"24"` — neither matched, so it always fell through to 12-hour mode. Fixed in: IndependentAlarmCard, AlertsViewModel, NotificationsView, RemindersView, ClockModal, ChitEditorScreen, DateZone, AlertsZone, TasksScreen, ChecklistsScreen, ProjectsScreen, ChitAlertsListView, NotesScreen, EmailViewModel, MainActivity (QuickAlertSheet).

## m20260521.1819

Fixed independent alerts (alarms/timers/stopwatches) not working properly in the Android app. Two bugs fixed: (1) `StandaloneAlertRepository.create()` was sending alarm data nested under a `"data"` key, but the server expects all fields flat at the top level — this caused double-nesting so alarm cards couldn't find time/days/enabled fields. (2) Timer and stopwatch update calls were sending partial bodies (e.g., just `name` or just `loop`), but the server's PUT endpoint replaces the entire record — so updating one field wiped all others. All update calls now send the full state. Also added fallback parsing in alarm and timer cards to handle the legacy nested format for previously-created alerts.

## m20260521.1714

Fixed CursorWindow crash that was preventing the app from functioning (and thus preventing any notifications). The `getChitsWithAlerts()` query was doing `SELECT *` on the 97-column chits table, overflowing the cursor window when chits have large email bodies or notes. Added a lightweight `ChitAlertProjection` that only selects the 12 columns needed for notification scheduling. The diagnostic report is still copied to clipboard on launch — paste it after 5 seconds to see the notification pipeline status.

## m20260521.1630

Notification debugging: on every app launch, the app now waits 5 seconds (for sync to populate DB), runs the full notification scheduling pipeline, and **copies a diagnostic report to the clipboard**. After launching the app, wait 5 seconds, then paste from clipboard to see exactly what's happening — how many chits have alerts, what the raw alert JSON looks like, whether parsing succeeds, and whether alarms are being scheduled or skipped as past.

## m20260521.1614

Fixed Android notifications still not firing after previous parseAlerts rewrite. Added `rescheduleAll()` call at app startup (in CwocApplication.onCreate) so alarms are re-registered every time the app launches — this catches cases where alarms were lost due to app updates, force-stops, or sync timing issues. Added comprehensive logging throughout the notification scheduling pipeline (tag: CWOC_NOTIF_SCHED) to diagnose any remaining issues via logcat.

## m20260521.1506

Fixed Android notifications/alarms not firing. Root cause: `NotificationSchedulerImpl.parseAlerts()` was looking for a `triggerAt` field and `type` field that don't exist in the actual alert JSON from the server. The server sends `_type` (with underscore) and uses `time`+`days` for alarms or `value`+`unit`+`targetType`+`afterTarget`+`atTarget` for notification offsets. Rewrote `parseAlerts()` to correctly compute absolute trigger times from the actual data format — alarms now find the next matching day-of-week occurrence, and notifications compute the offset relative to the chit's start/due/end/point datetime.

## m20260521.1445

Fixed Alerts tab: sidebar view mode buttons (Chits/Independent/Notifs/Reminders) now properly switch the content view. Removed duplicate mode toggle chips from the main content area. Fixed pull-to-refresh indicator getting stuck. Fixed independent alert creation (alarms, timers, stopwatches) not working from both the FAB long-press and the "+" buttons — root cause was the sidebar and AlertsViewModel using separate SharedPreferences keys, so the mode was out of sync and the data collection Flow was never activated.

## m20260521.1443

Fixed editor sidebars (Zone List panel and Actions panel) overlapping the Android system status bar. Added `statusBarsPadding()` to both editor sidebars and the Views panel so their content starts below the clock/battery/notification area.

## m20260521.1440

Fixed markdown not rendering in checklist items in the Android editor. The `InlineMarkdownRenderer` (bold, italic, inline code, links) was already built but wasn't being used — checklist items were displaying raw text. Now renders inline markdown properly.

## s20260521.1441 / m20260521.1441

Changed the New Chit FAB button to a regular hexagon shape with points at top and bottom (flat sides left/right) on both mobile web and Android app. Web uses CSS clip-path inside the 768px media query; Android uses a custom Compose Shape with a 6-vertex polygon path.

## m20260521.1437

Fixed two Android app issues: (1) Restored the search button to the right side of the top bar (fuse) — it was missing entirely, now navigates to the Search screen. (2) Fixed Omni view Reminders section not displaying any reminders — the filter was incorrectly looking for `absoluteTime`/`offsetMinutes` in alert JSON instead of matching the web logic (notification=true + point_in_time is today or pinned).

## s20260521.1148 / m20260521.1148

Fixed the New Chit FAB button on Android (moved from nested ChitListScaffold to the main Scaffold so it appears on ALL screens, not just Tasks/Notes/Notebook) and added a matching FAB to the web dashboard (fixed bottom-right, click = create chit, right-click = Quick Alert). Also fixed missing `onQuickAlert` parameter for TasksScreen in the nav graph.

## s20260521.1140 / m20260521.1140

Added swipe left/right to navigate calendar periods on mobile web and Android app. Swipe left for next period, swipe right for previous — works across all calendar sub-views (Day, Week, Work, X-Day, Month, Year, Itinerary).

## s20260521.1134 / m20260521.1134

Hidden the non-Kanban (list) mode toggle from the Projects view sidebar across all platforms (web, mobile web, Android). Kanban is now the only Projects view mode — the toggle buttons are removed and the mode is hardcoded to kanban.

## m20260521.0912

Fixed Android notifications/reminders completely broken. Four issues resolved:
1. **parseAlerts() format mismatch** — was looking for nonexistent `triggerAt` field. Rewrote to understand the actual web app format (time-of-day alarms with days-of-week, and notification offsets relative to chit datetimes).
2. **Local saves didn't schedule alarms** — ChitEditorViewModel now calls `notificationScheduler.scheduleAlarms()` after every save, and `cancelAlarms()` on delete.
3. **Snooze/Dismiss buttons were no-ops** — AlarmReceiver now properly handles snooze (reschedules 5min later) and dismiss (cancels notification) actions. Fixed Reminders channel to include default sound+vibration.
4. **Never asked for POST_NOTIFICATIONS permission** — Added runtime permission request on first launch (Android 13+). Without this, notifications were silently blocked by the OS.

## 20260521.0808

Overview zone parity: Title is now inline-editable in place (no separate input field). Notes preview shows a visual fade when content overflows. Removed color zone from overview. Added status, tags, people, and alerts rows to mobile browser overview (matching app). Android overview now shows actual checklist item text previews and alert/indicator counts instead of generic labels.

## s20260521.0817

Editor toolbars on mobile: pinned undo/redo buttons on the left side of a single row with a separator, remaining format buttons scroll horizontally. A fade mask appears on the right edge when there's overflow content to indicate scrollability. Zone header action buttons also use the same single-row scrollable pattern. Applies to notes toolbar, email toolbar, and all zone headers.

## m20260521.0817

Android editor: Notes format toolbar restructured to match mobile web — undo/redo pinned on left with separator, format buttons in a single horizontally scrollable row with fade overlay indicating overflow.

## m20260521.0755

Android app: Added parchment background color (#fff8dc) to checklist item containers in the editor, matching the mobile web's `.checklist-container` styling. Both unchecked and completed sections now have the bordered parchment background.
