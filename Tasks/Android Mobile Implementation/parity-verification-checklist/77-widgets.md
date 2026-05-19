# Widgets (Calendar, Tasks, Quick-Add, Refresh)

**Category:** Cross-Cutting Behaviors
**Item #:** 77
**Code Verified:** ⬜
**User Verified:** ⬜

## Source Files (Android-Only — No Web Equivalent)
- `android/app/src/main/java/com/cwoc/app/widget/quickadd/QuickAddWidgetProvider.kt`
- `android/app/src/main/java/com/cwoc/app/widget/calendar/TodayCalendarWidgetProvider.kt`
- `android/app/src/main/java/com/cwoc/app/widget/tasks/UpcomingTasksWidgetProvider.kt`
- `android/app/src/main/java/com/cwoc/app/widget/refresh/WidgetDataProvider.kt`
- `android/app/src/main/java/com/cwoc/app/widget/refresh/WidgetUpdateWorker.kt`
- `android/app/src/main/res/layout/widget_quick_add.xml`
- `android/app/src/main/res/xml/widget_quick_add_info.xml`
- `android/app/src/main/res/xml/widget_today_calendar_info.xml`
- `android/app/src/main/res/xml/widget_upcoming_tasks_info.xml`
- `android/app/src/main/AndroidManifest.xml` (widget receivers)

## Functions, Buttons, Controls & Inputs

### Quick Add Widget

- [ ] `QuickAddWidgetProvider` — AppWidgetProvider subclass for the Quick Add widget
- [ ] `onUpdate(context, appWidgetManager, appWidgetIds)` — Updates all widget instances with RemoteViews
- [ ] Widget layout (`R.layout.widget_quick_add`) — Parchment-themed single-tap widget
- [ ] Add icon click (`R.id.widget_add_icon`) — PendingIntent → opens MainActivity with `navigate_to = "editor/new"`
- [ ] Label click (`R.id.widget_label`) — Same PendingIntent as icon
- [ ] Logo click (`R.id.widget_logo`) — Same PendingIntent as icon
- [ ] Parchment theme colors — `#fffaf0` background, `#6b4e31` accent
- [ ] Widget info XML (`widget_quick_add_info`) — Defines min size, preview, resize mode

### Today Calendar Widget

- [ ] `TodayCalendarWidgetProvider` — AppWidgetProvider subclass for the Today Calendar widget
- [ ] `onUpdate(context, appWidgetManager, appWidgetIds)` — Updates widget with today's calendar items
- [ ] Displays today's chits with start/end times
- [ ] Shows chit titles and time ranges
- [ ] Parchment theme styling
- [ ] Widget info XML (`widget_today_calendar_info`) — Defines min size, preview, resize mode
- [ ] Tap item → opens chit in editor
- [ ] Empty state — "No events today" or similar

### Upcoming Tasks Widget

- [ ] `UpcomingTasksWidgetProvider` — AppWidgetProvider subclass for the Upcoming Tasks widget
- [ ] `onUpdate(context, appWidgetManager, appWidgetIds)` — Updates widget with upcoming tasks
- [ ] Shows up to 5 upcoming tasks (ToDo or In Progress) sorted by due date
- [ ] Displays task title and due date
- [ ] Parchment theme styling
- [ ] Widget info XML (`widget_upcoming_tasks_info`) — Defines min size, preview, resize mode
- [ ] Tap item → opens chit in editor
- [ ] Empty state — "No upcoming tasks" or similar

### Widget Data Provider

- [ ] `WidgetDataProvider` object — Singleton that provides data for widgets by reading from Room
- [ ] `getTodayCalendarChits(context): List<WidgetCalendarItem>` — Queries today's calendar chits sorted by start time
- [ ] `getUpcomingTasks(context): List<WidgetTaskItem>` — Queries up to 5 upcoming tasks sorted by due date
- [ ] `WidgetCalendarItem` data class — `id`, `title`, `startTime` (LocalDateTime?)
- [ ] `WidgetTaskItem` data class — `id`, `title`, `dueDate` (LocalDateTime?)
- [ ] `getDatabase(context)` — Gets Room database instance for widget queries
- [ ] No network calls — reads exclusively from local database

### Widget Refresh Worker

- [ ] `WidgetUpdateWorker` — WorkManager CoroutineWorker for periodic widget refresh
- [ ] `doWork()` — Calls `refreshAllWidgets(applicationContext)`, returns `Result.success()`
- [ ] `schedulePeriodic(context)` — Schedules periodic refresh every 30 minutes via PeriodicWorkRequest
- [ ] `refreshNow(context)` — Triggers immediate widget refresh (called after sync or CRUD)
- [ ] `refreshAllWidgets(context)` — Sends update broadcasts to all active widget providers
- [ ] Work name: `"cwoc_widget_refresh"`

### Widget DAO Queries (ChitDao)

- [ ] `getTodayChitsForWidget(dayStart, dayEnd)` — Query: non-deleted, non-archived chits with start/end/due/pointInTime within today's range
- [ ] `getUpcomingTasksForWidget()` — Query: non-deleted, non-archived chits with status ToDo/In Progress, ordered by due date

### AndroidManifest Widget Receivers

- [ ] `QuickAddWidgetProvider` receiver — exported, intent-filter `APPWIDGET_UPDATE`, meta-data `widget_quick_add_info`
- [ ] `TodayCalendarWidgetProvider` receiver — exported, intent-filter `APPWIDGET_UPDATE`, meta-data `widget_today_calendar_info`
- [ ] `UpcomingTasksWidgetProvider` receiver — exported, intent-filter `APPWIDGET_UPDATE`, meta-data `widget_upcoming_tasks_info`

### Widget Refresh Triggers

- [ ] After sync completion — `WidgetUpdateWorker.refreshNow(context)`
- [ ] After CRUD operations — `WidgetUpdateWorker.refreshNow(context)`
- [ ] Periodic (every 30 minutes) — via WorkManager scheduled job
- [ ] On device boot — via BOOT_COMPLETED receiver (if applicable)

### Notes

- [ ] Widgets are Android-only (no web equivalent exists)
- [ ] All widget data comes from local Room database (no network calls in widget context)
- [ ] Parchment theme must be applied consistently to all widget layouts
- [ ] Widget click actions use PendingIntent with FLAG_IMMUTABLE
