# Implementation Plan: Android Phase 4 — Feature Parity & Polish

## Overview

This plan implements the remaining C CAPTN views (Checklists, Projects/Kanban, Alerts, Indicators), map integration (osmdroid), home screen widgets (RemoteViews), pull-to-refresh, swipe actions, boolean search, recurrence expansion, animations, and a contact list screen. All code at `/android/`. Builds on Phase 3 architecture (Room, Hilt, Retrofit, sync engine, dirty tracking, WorkManager).

## Tasks

- [x] 1. Database migration and domain layer foundations
  - [x] 1.1 Create database migration v3 → v4
    - Add `data/local/Migration3To4.kt` with partial indexes for checklist, children, alerts, health_data, location, and contact name
    - Register migration in the Room database builder
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 1.2 Implement Boolean Search parser and evaluator
    - Create `domain/search/BooleanSearchParser.kt` with `SearchNode` sealed class (Term, And, Or, Not)
    - Implement recursive-descent parser supporting AND, OR, NOT (prefix `-`), parentheses
    - Create `domain/search/BooleanSearchEvaluator.kt` with `matches()` and `extractSearchableText()` (title, note, tags, checklist text)
    - Graceful fallback: treat unparseable input as a single term
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 1.3 Write property tests for Boolean Search
    - **Property 20: Boolean AND semantics**
    - **Property 21: Boolean OR semantics**
    - **Property 22: Boolean NOT semantics**
    - **Property 23: Boolean search multi-field coverage**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.6**

  - [x] 1.4 Implement Recurrence Engine
    - Create `domain/recurrence/RecurrenceEngine.kt` with `RecurrenceRule`, `RecurrenceInstance`, `RecurrenceException` data classes
    - Implement `expand()` supporting DAILY, WEEKLY, MONTHLY, YEARLY frequencies
    - Support `byDay`, `byMonthDay`, `bySetPos`, `until`, `count`, and exception handling
    - Implement `formatRule()` for human-readable display
    - Port logic from `shared-recurrence.js` to produce equivalent output
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 1.5 Write property tests for Recurrence Engine
    - **Property 24: Recurrence engine equivalence with JS**
    - **Property 25: Weekly recurrence respects byDay**
    - **Property 26: Recurrence exceptions are excluded**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.6, 12.8**

  - [x] 1.6 Implement Checklist domain operations
    - Create `domain/checklist/ChecklistOperations.kt` with `ChecklistItem` data class
    - Implement `toggleChecklistItem()`, `reorderChecklistItem()`, `indentationDp()`
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 1.7 Write property tests for Checklist operations
    - **Property 2: Checklist toggle is an involution**
    - **Property 3: Checklist indentation matches nesting depth**
    - **Property 4: Checklist reorder preserves all items**
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [x] 1.8 Implement Alert classification
    - Create `domain/alerts/AlertClassifier.kt` with `ClassifiedAlert`, `AlertSection` enum
    - Implement `classifyAlerts()` partitioning into UPCOMING/PAST by reference time, sorted ascending
    - _Requirements: 3.2, 3.3, 3.5_

  - [x] 1.9 Write property tests for Alert classification
    - **Property 8: Alert classification partitions correctly**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 1.10 Implement Chart data transformer
    - Create `domain/chart/ChartDataTransformer.kt` with `ChartDataPoint`, `ChartConfig`, `TimeRange`, `ChartType`
    - Implement `filterByRange()`, `mapToPixels()`, `hitTest()`
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 1.11 Write property tests for Chart data transformer
    - **Property 11: Chart coordinate mapping preserves order**
    - **Property 12: Chart hit-test returns nearest point**
    - **Property 13: Chart time range filter is correct**
    - **Validates: Requirements 4.4, 4.5, 4.6**

  - [x] 1.12 Implement Kanban status grouping
    - Create `ui/screens/projects/KanbanColumn.kt` with `KanbanStatus` enum
    - Implement `String.toKanbanStatus()` extension and `groupByKanbanStatus()`
    - _Requirements: 2.3, 2.6_

  - [x] 1.13 Write property tests for Kanban grouping
    - **Property 6: Kanban column assignment matches status**
    - **Property 7: Kanban column counts are accurate**
    - **Validates: Requirements 2.3, 2.6**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Swipe actions and dirty tracking
  - [x] 3.1 Implement swipe action logic
    - Create `ui/components/swipe/SwipeActionState.kt` with `SwipeActionResult`, `SwipeActionType`
    - Implement `applyArchive()`, `applySnooze()`, `undoSwipeAction()`
    - Integrate with existing dirty tracking via `ChitDao.markDirty(chitId, field)`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 3.2 Write property test for swipe undo
    - **Property 19: Swipe undo is a round-trip**
    - **Property 5: Mutation marks chit dirty with correct field**
    - **Validates: Requirements 10.5, 1.6, 2.4, 10.1, 10.3**

  - [x] 3.3 Implement swipe gesture composable
    - Create `ui/components/swipe/SwipeToAction.kt` Compose component
    - Green background + checkmark for right swipe (archive), orange + clock for left swipe (snooze)
    - Undo toast with 5-second countdown
    - _Requirements: 10.1, 10.2, 10.6_

- [x] 4. New C CAPTN view screens
  - [x] 4.1 Implement Checklists View
    - Create `ui/screens/checklists/ChecklistsViewModel.kt` with DAO query for checklist chits
    - Create `ui/screens/checklists/ChecklistsScreen.kt` with LazyColumn, nested indentation, toggle on tap, long-press drag-to-reorder
    - Dirty tracking on toggle/reorder with field `"checklist"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.2 Implement Projects/Kanban View
    - Create `ui/screens/projects/ProjectsViewModel.kt` with DAO query for project chits
    - Create `ui/screens/projects/ProjectsScreen.kt` with expandable project cards, horizontal Kanban columns
    - Implement drag-to-move between columns updating status + dirty tracking
    - Count badges on column headers
    - Tap card → navigate to Chit_Editor
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.3 Implement Alerts/Alarms View
    - Create `ui/screens/alerts/AlertsViewModel.kt` with DAO query for alert chits
    - Create `ui/screens/alerts/AlertsScreen.kt` with Upcoming/Past sections, sorted by time
    - Display alert type, scheduled time, chit title
    - Auto-move from Upcoming to Past when time passes (coroutine timer)
    - Tap → navigate to Chit_Editor
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.4 Implement Indicators/Health Charts View
    - Create `ui/screens/indicators/IndicatorsViewModel.kt` with DAO query for health data chits
    - Create `ui/components/chart/CanvasLineChart.kt` Compose Canvas composable
    - Create `ui/screens/indicators/IndicatorsScreen.kt` with one chart per indicator type
    - Time range selector (7d, 30d, 90d, all), tap-to-tooltip on data points
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.5 Write unit tests for new view screens
    - Test checklist filter correctness (Property 1)
    - Test indicator grouping (Property 10)
    - Test alert display fields (Property 9)
    - **Validates: Requirements 1.2, 3.5, 4.2**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Map integration
  - [x] 6.1 Configure osmdroid and implement Map Screen
    - Add osmdroid dependency to `build.gradle.kts`
    - Add `INTERNET` and `ACCESS_FINE_LOCATION` permissions to AndroidManifest
    - Create `ui/screens/map/MapViewModel.kt` with marker chits StateFlow, `computeBounds()`, `markerColor()`
    - Create `ui/screens/map/MapScreen.kt` wrapping osmdroid MapView in AndroidView composable
    - Configure custom user-agent, 100MB tile cache
    - Color-coded markers (chit color or default #6b4e31), tap popup with title/type/edit button
    - Fit bounds on load, "my location" button when permission granted
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 6.2 Write unit tests for map marker logic
    - **Property 14: Map markers match location-bearing chits**
    - **Property 15: Marker color resolution**
    - **Property 16: Map bounds encompass all markers**
    - **Validates: Requirements 5.3, 5.4, 5.6**

- [x] 7. Home screen widgets
  - [x] 7.1 Implement Quick Add Widget
    - Create `res/layout/widget_quick_add.xml` with CWOC logo + "+" icon
    - Create `res/xml/widget_quick_add_info.xml` metadata
    - Create `widget/quickadd/QuickAddWidgetProvider.kt` extending AppWidgetProvider
    - Tap launches Chit_Editor in create mode via PendingIntent
    - Parchment theme colors (#fffaf0 background, #6b4e31 accent)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.2 Implement Today Calendar Widget
    - Create `res/layout/widget_today_calendar.xml` and `widget_today_calendar_item.xml`
    - Create `res/xml/widget_today_calendar_info.xml` metadata
    - Create `widget/calendar/TodayCalendarWidgetProvider.kt`
    - Display today's chits sorted by start time, tap → Chit_Editor
    - Empty state: "No events today"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

  - [x] 7.3 Implement Upcoming Tasks Widget
    - Create `res/layout/widget_upcoming_tasks.xml` and `widget_upcoming_tasks_item.xml`
    - Create `res/xml/widget_upcoming_tasks_info.xml` metadata
    - Create `widget/tasks/UpcomingTasksWidgetProvider.kt`
    - Display up to 5 ToDo/In Progress chits sorted by due date, tap → Chit_Editor
    - Empty state: "All caught up!"
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [x] 7.4 Implement Widget data provider and refresh worker
    - Create `widget/refresh/WidgetDataProvider.kt` with `getTodayCalendarChits()` and `getUpcomingTasks()`
    - Create `widget/refresh/WidgetUpdateWorker.kt` as CoroutineWorker
    - Schedule periodic refresh (30 min) via WorkManager
    - Trigger immediate refresh on sync pull completion and local chit CRUD
    - Read exclusively from Room, no network calls
    - _Requirements: 7.5, 8.5, 17.1, 17.2, 17.3, 17.4_

  - [x] 7.5 Write unit tests for widget data queries
    - **Property 17: Today calendar widget shows correct chits**
    - **Property 18: Upcoming tasks widget filter and sort**
    - **Validates: Requirements 7.2, 8.2**

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Contact list and pull-to-refresh
  - [x] 9.1 Implement Contact List Screen
    - Create `ui/screens/contacts/ContactListViewModel.kt` with contacts StateFlow, search filtering, section index computation
    - Create `ui/screens/contacts/ContactListScreen.kt` with alphabetical list, search input, section index for quick scroll
    - Tap contact → navigate to contact detail/editor
    - Empty state: "No contacts found"
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7_

  - [x] 9.2 Write property tests for contact list
    - **Property 27: Contact list is alphabetically sorted with correct section index**
    - **Property 28: Contact search filters correctly**
    - **Validates: Requirements 14.2, 14.3, 14.5**

  - [x] 9.3 Implement Pull-to-Refresh wrapper
    - Create `PullToRefreshListScreen` composable using Material 3 `PullToRefreshBox`
    - Wire `onRefresh` to `SyncPullEngine.pull()`
    - Loading indicator while syncing, toast "Offline — showing cached data" on network failure
    - Apply to all list screens: Checklists, Projects, Alerts, Indicators, Contacts, and existing Phase 1-3 screens
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 14.6_

- [x] 10. Navigation, animations, and search integration
  - [x] 10.1 Update bottom navigation to full C CAPTN
    - Expand `CaptainTab` enum to 6 tabs: Calendar, Checklists, Alarms, Projects, Tasks, Notes
    - Update `BottomNavigation` composable with all tabs, icons, routes
    - Active tab highlighted with #6b4e31, inactive muted
    - Preserve scroll position and filter state per tab via `rememberSaveable`
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 10.2 Write property test for tab state preservation
    - **Property 29: Tab state preservation round-trip**
    - **Validates: Requirements 15.3**

  - [x] 10.3 Implement animations and transitions
    - Configure `AnimatedNavHost` with fadeIn/fadeOut (250ms) for screen navigation
    - Add `AnimatedVisibility` + slideInVertically + fadeIn (300ms) for list item add
    - Add `AnimatedVisibility` + slideOutHorizontally + fadeOut (250ms) for list item remove
    - Drag feedback: `graphicsLayer { scaleX/Y = 1.05f; shadowElevation = 8.dp }`
    - Drop settle: `animateItemPlacement()` on LazyColumn (200ms)
    - Content resize: `animateContentSize()` (200ms)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 10.4 Integrate Boolean Search into main list screen
    - Add search input to main chit list screen
    - Wire to `BooleanSearchParser` + `BooleanSearchEvaluator`
    - Real-time filtering with 300ms debounce
    - _Requirements: 11.1, 11.7_

  - [x] 10.5 Integrate Recurrence Engine into calendar/task views
    - Call `RecurrenceEngine.expand()` when rendering calendar and task views
    - Generate expanded instances within the visible date range
    - _Requirements: 12.7_

  - [x] 10.6 Wire Map Screen and Contact List into navigation
    - Add Map_Screen route accessible from navigation drawer or menu
    - Add Contact_List_Screen route accessible from navigation structure
    - _Requirements: 5.1, 14.1_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code resides at `/android/` and builds on Phase 3 architecture
- The design uses Kotlin + Jetpack Compose — no language selection needed
- Widgets use RemoteViews XML (not Compose Glance) per design decision
- osmdroid is the map library (not Google Maps) per design decision

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4", "1.6", "1.8", "1.10", "1.12"] },
    { "id": 1, "tasks": ["1.3", "1.5", "1.7", "1.9", "1.11", "1.13"] },
    { "id": 2, "tasks": ["3.1", "4.1", "4.2", "4.3", "4.4"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.5"] },
    { "id": 4, "tasks": ["6.1", "7.1", "7.2", "7.3", "9.1"] },
    { "id": 5, "tasks": ["6.2", "7.4", "9.2", "9.3"] },
    { "id": 6, "tasks": ["7.5", "10.1", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 7, "tasks": ["10.2"] }
  ]
}
```
