# Implementation Plan: Android Home Screen Widgets

## Overview

Implement 8 Android home screen widgets for the CWOC app, building on the existing `WidgetDataProvider`, `WidgetUpdateWorker`, and `AppWidgetProvider` infrastructure. All widgets use `RemoteViews`, read from the local Room database, and follow the parchment theme. Implementation proceeds from shared infrastructure → individual widgets → integration wiring.

## Tasks

- [x] 1. Extend shared widget infrastructure
  - [x] 1.1 Add new data model classes to the widget refresh package
    - Create `WidgetOmniItem`, `WidgetChecklistItem`, `WidgetChecklistSummary`, `WidgetAlarmItem`, `WidgetProjectProgress`, `WidgetProjectSummary`, `WidgetWeatherData`, `WidgetDayCount` data classes in a new file `com/cwoc/app/widget/refresh/WidgetDataModels.kt`
    - Include all fields as specified in the design document (category colors, countdown text, progress percent, HST color, etc.)
    - _Requirements: 9.1_

  - [x] 1.2 Add utility functions for title truncation, HST calculation, and countdown formatting
    - Create `com/cwoc/app/widget/refresh/WidgetUtils.kt` with:
      - `truncateTitle(text: String, limit: Int): String` — returns original if ≤ limit, else first (limit-1) chars + "…"
      - `calculateHst(hours: Int, minutes: Int, seconds: Int): Pair<String, Float>` — returns formatted "XX.XXX sd" string and progress fraction (0.0–1.0)
      - `formatCountdown(secondsRemaining: Long): String` — returns "Xd Yh", "Xh Ym", or "Xm" based on thresholds
      - `resolveHstColor(hue: Float?, saturation: Float?, tone: Float?, defaultColor: Int): Int` — resolves HST color or returns default
    - _Requirements: 4.2, 8.1, 8.2, 5.3_

  - [x] 1.3 Add WMO weather code mapping utility
    - Create `com/cwoc/app/widget/refresh/WmoCodeMapper.kt` with:
      - `getWeatherIcon(wmoCode: Int): Int` — maps WMO codes 0–99 to drawable resource IDs
      - `getConditionText(wmoCode: Int): String` — maps WMO codes to human-readable text (max 20 chars)
    - Cover all standard WMO weather interpretation codes (clear, cloudy, fog, drizzle, rain, snow, thunderstorm, etc.)
    - _Requirements: 6.3_

  - [x] 1.4 Extend WidgetDataProvider with new query methods
    - Add `getOmniViewChits(context, limit)` — queries non-deleted chits respecting Omni View settings from SharedPreferences, returns up to 20 `WidgetOmniItem`s
    - Add `getChecklistItems(context, chitId)` — parses checklist JSON for a specific chit, returns `WidgetChecklistItem` list with depth calculation
    - Add `getChecklistChits(context)` — returns all non-deleted chits that have checklist data
    - Add `toggleChecklistItem(context, chitId, itemIndex)` — flips checked state at index, marks chit dirty, returns success boolean
    - Add `getUpcomingAlarms(context, limit)` — returns next N future alarms sorted by trigger time ascending
    - Add `getProjectProgress(context, projectId)` — calculates completion ratio from child chits
    - Add `getProjectChits(context)` — returns all non-deleted project chits
    - Add `getWeatherData(context, locationKey)` — fetches weather from Open-Meteo API for given coordinates
    - Add `getWeeklyCounts(context, weekStartDate)` — counts chits per day for a 7-day range
    - Add `isLoggedIn(context)` — checks EncryptedSharedPreferences for valid auth token
    - _Requirements: 9.1, 3.4, 4.1, 5.2, 6.4, 7.2_

  - [x] 1.5 Extend WidgetUpdateWorker to broadcast to all new widget providers
    - Add broadcast blocks for `OmniViewWidgetProvider`, `ChecklistWidgetProvider`, `UpcomingAlarmsWidgetProvider`, `ProjectProgressWidgetProvider`, `WeatherWidgetProvider`, `WeeklyOverviewWidgetProvider`, `HstTimeBarWidgetProvider`, `QuickCaptureWidgetProvider` in `refreshAllWidgets()`
    - _Requirements: 9.4, 3.10, 1.8_

  - [x] 1.6 Create BaseWidgetConfigActivity abstract class
    - Create `com/cwoc/app/widget/config/BaseWidgetConfigActivity.kt`
    - Extract common config activity logic: read `appWidgetId` from intent, access `"cwoc_widget_config"` SharedPreferences, provide `saveConfig(key, value)`, `finishWithResult()`, `cancelConfig()` methods
    - _Requirements: 9.6_

- [x] 2. Checkpoint - Ensure shared infrastructure compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement HST Time Bar Widget
  - [x] 3.1 Create HST Time Bar widget layout and info XML
    - Create `res/layout/widget_hst_bar.xml` — parchment background (#f5e6cc), 1dp brown border (#8b4513), 6dp rounded corners, 8dp height progress bar with gradient, bold centered 16sp text in #4a2c2a with white text shadow
    - Create `res/xml/widget_hst_bar_info.xml` — minWidth 180dp, minHeight 40dp, resizeMode horizontal, updatePeriodMillis 0 (Handler-managed), widgetCategory home_screen
    - Create gradient drawable `res/drawable/hst_bar_gradient.xml` — linear gradient #d4af37 → #c8965a → #8b4513
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 9.3_

  - [x] 3.2 Implement HstTimeBarWidgetProvider
    - Create `com/cwoc/app/widget/hstbar/HstTimeBarWidgetProvider.kt`
    - In `onUpdate()`: calculate current HST using `WidgetUtils.calculateHst()`, set progress bar width percentage, set text to formatted HST value
    - In `onEnabled()`: register `BroadcastReceiver` for `ACTION_SCREEN_ON`/`ACTION_SCREEN_OFF`, start 1-second Handler timer
    - In `onDisabled()`: unregister receiver, stop Handler timer
    - Handler callback: recalculate HST, update RemoteViews, call `appWidgetManager.updateAppWidget()`
    - No tap action (info-only display)
    - _Requirements: 8.1, 8.6, 8.7, 8.8, 8.9_

  - [ ]* 3.3 Write property test for HST time calculation
    - **Property 1: HST Time Calculation**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 3.4 Write property test for title truncation utility
    - **Property 11: Title Truncation**
    - **Validates: Requirements 4.2, 6.3**

- [x] 4. Implement Upcoming Alarms Widget
  - [x] 4.1 Create Upcoming Alarms widget layout and info XML
    - Create `res/layout/widget_upcoming_alarms.xml` — parchment background, vertical list of up to 3 alarm entries (title + countdown), empty state text view
    - Create `res/layout/widget_alarm_item.xml` — single alarm row with title (left) and countdown badge (right)
    - Create `res/xml/widget_upcoming_alarms_info.xml` — minWidth 250dp, minHeight 110dp (4×2), resizeMode horizontal|vertical, updatePeriodMillis 0 (managed by WorkManager + AlarmManager for countdown)
    - _Requirements: 4.1, 9.3_

  - [x] 4.2 Implement UpcomingAlarmsWidgetProvider
    - Create `com/cwoc/app/widget/alarms/UpcomingAlarmsWidgetProvider.kt`
    - In `onUpdate()`: call `WidgetDataProvider.getUpcomingAlarms(context, 3)`, populate up to 3 alarm item views with truncated titles (30 chars) and formatted countdown text
    - Handle empty state: show "No upcoming alarms" message
    - Auth guard: check `isLoggedIn()`, show "Please log in" if not authenticated
    - Set up tap PendingIntents to open editor for each alarm's chit
    - Schedule AlarmManager for countdown refresh: every 60s when nearest alarm < 1h, every 15min otherwise
    - Handle `onReceive()` for alarm-triggered refresh broadcasts
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.5_

  - [ ]* 4.3 Write property test for countdown timer formatting
    - **Property 2: Countdown Timer Formatting**
    - **Validates: Requirements 4.2**

  - [ ]* 4.4 Write property test for alarm filtering and sorting
    - **Property 3: Alarm Filtering and Sorting**
    - **Validates: Requirements 4.1, 4.5**

- [x] 5. Implement Checklist Widget
  - [x] 5.1 Create Checklist widget layouts and info XML
    - Create `res/layout/widget_checklist.xml` — parchment background, title text view at top, ListView for checklist items, empty/unavailable state text view
    - Create `res/layout/widget_checklist_item.xml` — checkbox + text with variable left padding for depth (0dp, 16dp, 32dp)
    - Create `res/layout/activity_checklist_config.xml` — list of available checklists for selection, empty state message
    - Create `res/xml/widget_checklist_info.xml` — minWidth 180dp, minHeight 180dp, resizeMode horizontal|vertical, configure activity reference, updatePeriodMillis 0
    - _Requirements: 3.2, 3.3, 9.3_

  - [x] 5.2 Implement ChecklistWidgetConfigActivity
    - Create `com/cwoc/app/widget/checklist/ChecklistWidgetConfigActivity.kt` extending `BaseWidgetConfigActivity`
    - On create: query `WidgetDataProvider.getChecklistChits()`, display list of checklist titles
    - On selection: save chit ID to SharedPreferences as `checklist_{appWidgetId}`, call `finishWithResult()`
    - Handle empty state: show "No checklists available" message
    - _Requirements: 3.1, 9.6_

  - [x] 5.3 Implement ChecklistRemoteViewsService and Factory
    - Create `com/cwoc/app/widget/checklist/ChecklistRemoteViewsService.kt` — standard RemoteViewsService returning the factory
    - Create `com/cwoc/app/widget/checklist/ChecklistRemoteViewsFactory.kt` — implements `RemoteViewsFactory`
    - In `onDataSetChanged()`: read configured chit ID from SharedPreferences, call `WidgetDataProvider.getChecklistItems()`
    - In `getViewAt()`: inflate `widget_checklist_item`, set text, set checked state, apply depth-based indentation (index × 16dp), set fill-in intent for checkbox toggle and item tap
    - _Requirements: 3.2, 3.3, 3.5_

  - [x] 5.4 Implement ChecklistWidgetProvider
    - Create `com/cwoc/app/widget/checklist/ChecklistWidgetProvider.kt`
    - In `onUpdate()`: set up RemoteViews with ListView adapter pointing to `ChecklistRemoteViewsService`, set title from configured chit, set up PendingIntent templates for checkbox toggle and item tap
    - In `onReceive()`: handle custom `ACTION_TOGGLE_CHECKBOX` — call `WidgetDataProvider.toggleChecklistItem()`, trigger sync push, schedule revert on failure after 5 seconds
    - Handle unavailable state: if configured chit returns null, show "Checklist unavailable — reconfigure" message
    - Auth guard: check `isLoggedIn()`, show "Please log in" if not authenticated
    - In `onDeleted()`: remove SharedPreferences entry for deleted widget ID
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 9.5, 9.7_

  - [ ]* 5.5 Write property test for checklist toggle preserves other items
    - **Property 4: Checklist Toggle Preserves Other Items**
    - **Validates: Requirements 3.4**

  - [ ]* 5.6 Write property test for checklist depth calculation
    - **Property 5: Checklist Depth Calculation**
    - **Validates: Requirements 3.3**

- [x] 6. Checkpoint - Ensure HST, Alarms, and Checklist widgets compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Project Progress Widget
  - [x] 7.1 Create Project Progress widget layouts and info XML
    - Create `res/layout/widget_project_progress.xml` — parchment background, project title text (single line, ellipsize end), horizontal progress bar (HST-colored fill), "X of Y" count text
    - Create `res/layout/activity_project_config.xml` — list of available projects for selection
    - Create `res/xml/widget_project_progress_info.xml` — minWidth 180dp, minHeight 70dp, resizeMode horizontal|vertical, configure activity reference, updatePeriodMillis 0
    - _Requirements: 5.2, 5.4, 5.5, 9.3_

  - [x] 7.2 Implement ProjectProgressConfigActivity
    - Create `com/cwoc/app/widget/progress/ProjectProgressConfigActivity.kt` extending `BaseWidgetConfigActivity`
    - On create: query `WidgetDataProvider.getProjectChits()`, display list of project titles
    - On selection: save chit ID to SharedPreferences as `project_{appWidgetId}`, call `finishWithResult()`
    - _Requirements: 5.1, 9.6_

  - [x] 7.3 Implement ProjectProgressWidgetProvider
    - Create `com/cwoc/app/widget/progress/ProjectProgressWidgetProvider.kt`
    - In `onUpdate()`: read configured project ID from SharedPreferences, call `WidgetDataProvider.getProjectProgress()`, set progress bar fill width and color (HST color or default #6b4e31), set "X of Y" text, set title
    - Handle zero children: show 0% bar with "0 of 0" text
    - Handle deleted project: show "Project unavailable — reconfigure" message
    - Auth guard: check `isLoggedIn()`, show "Please log in" if not authenticated
    - Set up tap PendingIntent to open project view in app
    - In `onDeleted()`: remove SharedPreferences entry for deleted widget ID
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 9.5, 9.7_

  - [ ]* 7.4 Write property test for project progress computation
    - **Property 6: Project Progress Computation**
    - **Validates: Requirements 5.2, 5.3, 5.9**

- [x] 8. Implement Weather Widget
  - [x] 8.1 Create Weather widget layouts and info XML
    - Create `res/layout/widget_weather.xml` — parchment background, weather icon (ImageView), temperature text, condition text, stale indicator (timestamp), unavailable state text
    - Create `res/layout/activity_weather_config.xml` — list of saved locations + custom location entry field with geocode validation, error message area
    - Create `res/xml/widget_weather_info.xml` — minWidth 110dp, minHeight 110dp (2×2), resizeMode horizontal|vertical, configure activity reference, updatePeriodMillis 1800000 (30 min)
    - _Requirements: 6.3, 6.1, 9.3_

  - [x] 8.2 Implement WeatherWidgetConfigActivity
    - Create `com/cwoc/app/widget/weather/WeatherWidgetConfigActivity.kt` extending `BaseWidgetConfigActivity`
    - On create: load saved locations from Room (via WidgetDataProvider or direct query), display as selectable list
    - Provide custom location text field with geocode button — call Nominatim API to resolve coordinates
    - On geocode failure: show error "Location could not be found", block completion
    - On valid selection: save `weather_location_{id}`, `weather_lat_{id}`, `weather_lon_{id}`, `weather_label_{id}` to SharedPreferences, call `finishWithResult()`
    - Handle no saved locations: show only the custom entry field with prompt
    - _Requirements: 6.1, 6.2, 6.7, 6.10, 9.6_

  - [x] 8.3 Implement WeatherWidgetProvider
    - Create `com/cwoc/app/widget/weather/WeatherWidgetProvider.kt`
    - In `onUpdate()`: read configured location from SharedPreferences, call `WidgetDataProvider.getWeatherData()`, set temperature text (respecting user's unit system), set weather icon from WMO code mapping, set condition text (truncated to 20 chars)
    - Handle stale data: show last-known values + stale indicator with "Updated: HH:mm" timestamp
    - Handle no data: show "Weather unavailable" message
    - Auth guard: check `isLoggedIn()`, show "Please log in" if not authenticated
    - Set up tap PendingIntent to open weather page in app
    - In `onDeleted()`: remove SharedPreferences entries for deleted widget ID
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 9.5, 9.7_

  - [ ]* 8.4 Write property test for WMO weather code mapping
    - **Property 10: WMO Weather Code Mapping**
    - **Validates: Requirements 6.3**

- [x] 9. Implement Weekly Overview Widget
  - [x] 9.1 Create Weekly Overview widget layout and info XML
    - Create `res/layout/widget_weekly_overview.xml` — parchment background, horizontal LinearLayout with 7 day cells, each cell containing day abbreviation text, date number text, and chit count text; today cell highlighted with #6b4e31 accent
    - Create `res/layout/widget_weekly_day_cell.xml` — single day cell: day abbrev (top), date number (middle), count badge (bottom)
    - Create `res/xml/widget_weekly_overview_info.xml` — minWidth 250dp, minHeight 70dp (4×1), resizeMode horizontal, updatePeriodMillis 0
    - _Requirements: 7.1, 7.3, 9.3_

  - [x] 9.2 Implement WeeklyOverviewWidgetProvider
    - Create `com/cwoc/app/widget/weekly/WeeklyOverviewWidgetProvider.kt`
    - In `onUpdate()`: determine current week start based on user's week-start preference (from settings), call `WidgetDataProvider.getWeeklyCounts()`, populate 7 day cells with abbreviation, date number, and chit count
    - Highlight today's cell with accent color background/border
    - Set up tap PendingIntents: day cell tap → open calendar to that day, header tap → open calendar to week view
    - Auth guard: check `isLoggedIn()`, show "Please log in" if not authenticated
    - Handle week rollover: detect when current date passes displayed week's end, trigger refresh
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.5_

  - [ ]* 9.3 Write property test for weekly day count aggregation
    - **Property 7: Weekly Day Count Aggregation**
    - **Validates: Requirements 7.2**

  - [ ]* 9.4 Write property test for week range calculation
    - **Property 8: Week Range Calculation**
    - **Validates: Requirements 7.1**

- [x] 10. Implement Omni View Widget
  - [x] 10.1 Create Omni View widget layout and info XML
    - Create `res/layout/widget_omni_view.xml` — parchment background, ListView for scrollable chit cards, empty state text view
    - Create `res/layout/widget_omni_view_item.xml` — chit card with colored left border (4dp wide View), title text, status icon, due date badge, priority marker
    - Create `res/xml/widget_omni_view_info.xml` — minWidth 250dp, minHeight 110dp (4×1 default), resizeMode horizontal|vertical, updatePeriodMillis 0
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 9.3_

  - [x] 10.2 Implement OmniViewRemoteViewsService and Factory
    - Create `com/cwoc/app/widget/omniview/OmniViewRemoteViewsService.kt` — standard RemoteViewsService
    - Create `com/cwoc/app/widget/omniview/OmniViewRemoteViewsFactory.kt` — implements `RemoteViewsFactory`
    - In `onDataSetChanged()`: call `WidgetDataProvider.getOmniViewChits(context, 20)` respecting user's sort order, visible categories, and active filters
    - In `getViewAt()`: inflate `widget_omni_view_item`, set colored left border, title, status icon visibility, due date badge, priority marker; set fill-in intent for tap-to-open-editor
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7_

  - [x] 10.3 Implement OmniViewWidgetProvider
    - Create `com/cwoc/app/widget/omniview/OmniViewWidgetProvider.kt`
    - In `onUpdate()`: set up RemoteViews with ListView adapter pointing to `OmniViewRemoteViewsService`, set up PendingIntent template for item taps (open editor)
    - Handle empty state: show "No chits match current filters" message
    - Auth guard: check `isLoggedIn()`, show "Please log in" if not authenticated
    - Handle resize: `onAppWidgetOptionsChanged()` to recalculate visible items
    - _Requirements: 1.1, 1.3, 1.7, 1.8, 1.9, 1.10, 1.11, 9.5_

  - [ ]* 10.4 Write property test for Omni View filter compliance
    - **Property 9: Omni View Filter Compliance**
    - **Validates: Requirements 1.4, 1.1**

- [x] 11. Implement Quick Capture Widget
  - [x] 11.1 Create Quick Capture widget layout and info XML
    - Create `res/layout/widget_quick_capture.xml` — 1×1 parchment background with centered "+" icon (Font Awesome or vector drawable)
    - Create `res/xml/widget_quick_capture_info.xml` — minWidth 40dp, minHeight 40dp (1×1), resizeMode none, updatePeriodMillis 0
    - _Requirements: 2.1, 9.3_

  - [x] 11.2 Create QuickCaptureMenuActivity
    - Create `res/layout/activity_quick_capture_menu.xml` — transparent background, floating card with 6 creation options (Task, Note, Checklist, Project, Calendar Event, Alarm) as a vertical list with icons
    - Create `com/cwoc/app/widget/quickcapture/QuickCaptureMenuActivity.kt`
    - Use transparent theme (`Theme.AppCompat.NoActionBar` with transparent window background)
    - On option tap: launch `MainActivity` with `navigate_to = "editor/new?type=<type>"`, finish activity
    - On outside tap or Back press: `finish()` without action
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 11.3 Implement QuickCaptureWidgetProvider
    - Create `com/cwoc/app/widget/quickcapture/QuickCaptureWidgetProvider.kt`
    - In `onUpdate()`: set up RemoteViews with "+" icon, set PendingIntent to launch `QuickCaptureMenuActivity`
    - No data queries needed — purely a launcher widget
    - _Requirements: 2.1, 2.2_

- [x] 12. Checkpoint - Ensure all widget providers compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Register all widgets in AndroidManifest and wire integration
  - [x] 13.1 Add all widget receiver and activity declarations to AndroidManifest.xml
    - Add `<receiver>` entries for all 8 new widget providers with `android:exported="true"`, `ACTION_APPWIDGET_UPDATE` intent filter, and `<meta-data>` pointing to respective `widget_*_info.xml`
    - Add `<activity>` entries for `ChecklistWidgetConfigActivity`, `ProjectProgressConfigActivity`, `WeatherWidgetConfigActivity` with `ACTION_APPWIDGET_CONFIGURE` intent filter
    - Add `<activity>` entry for `QuickCaptureMenuActivity` with transparent theme
    - Add `<service>` entries for `OmniViewRemoteViewsService` and `ChecklistRemoteViewsService` with `BIND_REMOTEVIEWS` permission
    - _Requirements: 9.3_

  - [x] 13.2 Add string resources for widget descriptions and labels
    - Add widget description strings to `res/values/strings.xml` for all 8 widgets (used in widget picker)
    - Add empty state message strings: "No chits match current filters", "No upcoming alarms", "No checklists available", "Checklist unavailable", "Project unavailable", "Weather unavailable", "Please log in"
    - _Requirements: 1.9, 3.1, 3.8, 4.7, 5.10, 6.9, 9.5_

  - [x] 13.3 Wire sync engine to trigger widget refresh on pull completion
    - In the existing `SyncEngine` (or wherever sync pull completes), add call to `WidgetUpdateWorker.refreshNow(context)` after successful sync pull
    - Ensure local chit CRUD operations also call `WidgetUpdateWorker.refreshNow(context)`
    - _Requirements: 1.8, 3.9, 5.8, 7.6, 9.4_

  - [x] 13.4 Add preview images for widget picker
    - Create placeholder preview drawables in `res/drawable/` for each widget: `widget_preview_omni_view.xml`, `widget_preview_quick_capture.xml`, `widget_preview_checklist.xml`, `widget_preview_alarms.xml`, `widget_preview_progress.xml`, `widget_preview_weather.xml`, `widget_preview_weekly.xml`, `widget_preview_hst_bar.xml`
    - Reference preview images in each widget info XML via `android:previewImage`
    - _Requirements: 9.3_

- [x] 14. Final checkpoint - Ensure all widgets compile and manifest is valid
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All widgets follow the existing pattern established by `TodayCalendarWidgetProvider` and `WidgetDataProvider`
- The implementation language is Kotlin, matching the existing Android codebase
- No software installation tasks are included — only code creation and modification
- The HST Time Bar widget is implemented first because it has no data dependencies (uses system clock only)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.6"] },
    { "id": 1, "tasks": ["1.4", "1.5"] },
    { "id": 2, "tasks": ["3.1", "4.1", "5.1", "7.1", "8.1", "9.1", "10.1", "11.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.2", "4.3", "4.4", "5.2", "7.2", "8.2", "9.2", "9.3", "9.4", "10.2", "11.2"] },
    { "id": 4, "tasks": ["5.3", "5.5", "5.6", "7.3", "7.4", "8.3", "8.4", "10.3", "10.4", "11.3"] },
    { "id": 5, "tasks": ["5.4"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.4"] },
    { "id": 7, "tasks": ["13.3"] }
  ]
}
```
