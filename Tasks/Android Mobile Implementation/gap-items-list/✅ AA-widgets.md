# AA — Widgets (1 item: AA1)

## Status: COMPLETE — all 7 sub-items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/widget/refresh/WidgetDataProvider.kt` — fixed missing migrations

## Android files verified (pre-existing, fully implemented):
- `android/app/src/main/java/com/cwoc/app/widget/calendar/TodayCalendarWidgetProvider.kt`
- `android/app/src/main/java/com/cwoc/app/widget/tasks/UpcomingTasksWidgetProvider.kt`
- `android/app/src/main/java/com/cwoc/app/widget/quickadd/QuickAddWidgetProvider.kt`
- `android/app/src/main/java/com/cwoc/app/widget/refresh/WidgetUpdateWorker.kt`
- `android/app/src/main/res/layout/widget_today_calendar.xml` + item layout
- `android/app/src/main/res/layout/widget_upcoming_tasks.xml` + item layout
- `android/app/src/main/res/layout/widget_quick_add.xml`
- `android/app/src/main/res/xml/widget_today_calendar_info.xml`
- `android/app/src/main/res/xml/widget_upcoming_tasks_info.xml`
- `android/app/src/main/res/xml/widget_quick_add_info.xml`
- `AndroidManifest.xml` — all 3 widgets registered as receivers

---

## AA1 — All 3 widgets non-functional on device ✅ COMPLETE (7/7 sub-items)

1. ✅ Widget code fully implemented — TodayCalendarWidgetProvider, UpcomingTasksWidgetProvider, QuickAddWidgetProvider
2. ✅ Calendar widget displays upcoming events — reads from Room via `getChitsForDaySuspend()`
3. ✅ Quick-add widget creates new chits — launches MainActivity with editor intent
4. ✅ Tasks widget shows task list — reads from Room via `getUpcomingTasksSuspend()`
5. ✅ **FIX: Added MIGRATION_5_6 and MIGRATION_6_7 to WidgetDataProvider.getDatabase()** — this was the root cause (widget DB instance was missing latest migrations, causing crash)
6. ✅ Widget metadata XMLs define configuration (min size, preview, resize mode)
7. ✅ WidgetUpdateWorker refreshes all widgets every 30 minutes + on-demand via `refreshNow()`
