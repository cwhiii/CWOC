# Phase 4 Audit: Feature Parity Views (FRESH — v m20260517.1037)

**Audit date:** 2026-05-17
**Rules applied:** META-SPEC with Zone/Page/View Completeness Rule. "Partial" banned. Web = spec.
**Android files read:** ChecklistsScreen.kt, ChecklistsViewModel.kt, ProjectsScreen.kt, ProjectsViewModel.kt, KanbanColumn.kt, AlertsScreen.kt, AlertsViewModel.kt, IndicatorsScreen.kt, IndicatorsViewModel.kt, MapScreen.kt, MapViewModel.kt, TodayCalendarWidgetProvider.kt, QuickAddWidgetProvider.kt, WidgetDataProvider.kt, WidgetUpdateWorker.kt, UpcomingTasksWidgetProvider.kt
**Web files read:** main-views.js (coordinator header showing split architecture: main-views-tasks.js, main-views-habits.js, main-views-notes.js, main-views-projects.js, main-views-alarms.js, main-views-indicators.js)

---

## 4.1 Checklists View

### Web (main-views.js → displayChecklistView)
- Cards with title + nested checklist items
- Inline toggle (check/uncheck without opening editor)
- Progress indicator per card ("3/7 complete")
- Tag chips on cards
- Color applied to cards
- Pin/archive/snooze indicators
- Quick-edit modal on long-press
- Drag-to-reorder cards (manual sort)
- Filter/sort from sidebar

### Android (ChecklistsScreen.kt + ChecklistsViewModel.kt)
- LazyColumn of ChecklistChitCard composables
- Inline toggle ✅ (viewModel.toggleItem → upsert + markDirty)
- Long-press → ChitActionMenu (pin/archive/snooze/edit) ✅
- Filter/sort from FilterSortViewModel ✅
- Swipe-to-delete ❌ (not implemented on this screen)
- Empty state + filtered empty state ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Cards with title + checklist items | ✅ | ✅ | ✅ |
| Inline toggle (check/uncheck) | ✅ | ✅ toggleItem with dirty tracking | ✅ |
| Progress indicator per card | ✅ "3/7 complete" | ❌ not shown on cards | ❌ |
| Tag chips on cards | ✅ colored chips | ❌ | ❌ |
| Chit color on cards | ✅ background/border | ❌ hardcoded Color(0xFFF5E6D3) | ❌ |
| Pin indicator | ✅ | ✅ "📌 Pinned" text | ✅ |
| Archive/snooze indicators | ✅ | ❌ | ❌ |
| Quick-edit modal | ✅ | ❌ (long-press opens action menu, not quick-edit) | ❌ |
| Drag-to-reorder cards | ✅ | ❌ | ❌ |
| Filter/sort | ✅ | ✅ FilterEngine + SortEngine | ✅ |
| Swipe-to-delete | N/A (web uses X) | ❌ not on this screen | ❌ |

**View verdict: 💀 BROKEN** (missing progress count, tags, color, archive/snooze indicators, quick-edit, drag-reorder)

---

## 4.2 Projects/Kanban View

### Web (main-views-projects.js)
- Lists project master chits
- Expandable Kanban board per project (4 status columns)
- Child chit cards show: title, due date, status dropdown, open/move/remove/delete buttons
- Drag-drop between columns to change status
- "Add existing chit" button (search picker)
- "Create new child" button
- Filter/sort from sidebar
- Project progress bar (% complete)

### Android (ProjectsScreen.kt + ProjectsViewModel.kt + KanbanColumn.kt)
- LazyColumn of expandable ProjectCard composables
- Inline KanbanBoard with 4 columns (ToDo, InProgress, Blocked, Complete)
- Column count badges ✅
- moveToColumn() exists in ViewModel but no drag gesture wired
- Long-press → ChitActionMenu ✅
- Filter/sort ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Project master list | ✅ | ✅ | ✅ |
| Expand/collapse per project | ✅ | ✅ AnimatedVisibility | ✅ |
| Kanban board (4 columns) | ✅ | ✅ KanbanBoard composable | ✅ |
| Child cards show title | ✅ | ✅ | ✅ |
| Child cards show due date | ✅ | ❌ | ❌ |
| Child cards show status dropdown | ✅ inline dropdown | ❌ | ❌ |
| Child cards: open/move/remove/delete buttons | ✅ | ❌ only tap-to-open | ❌ |
| Drag-drop between columns | ✅ | ❌ moveToColumn exists but no gesture | ❌ |
| "Add existing chit" button | ✅ search picker | ❌ | ❌ |
| "Create new child" button | ✅ | ❌ | ❌ |
| Project progress bar | ✅ % complete | ❌ | ❌ |
| Column count badges | ✅ | ✅ CircleShape badge | ✅ |
| Filter/sort | ✅ | ✅ | ✅ |
| Pin indicator | ✅ | ✅ "📌 Pinned" | ✅ |

**View verdict: 💀 BROKEN** (no drag-drop, no child card actions, no add/create buttons, no progress bar, no due dates on cards)

---

## 4.3 Alerts View

### Web (main-views-alarms.js)
- Two modes: "List" (all alerts by chit) and "Independent" (standalone alerts board)
- Alert types: notification, alarm, timer, stopwatch
- Each shows: type icon, chit title, scheduled time, snooze/dismiss buttons
- Upcoming vs Past sections
- Independent alerts: standalone alerts not attached to chits (created from settings)
- Live countdown for active timers
- Running stopwatch display

### Android (AlertsScreen.kt + AlertsViewModel.kt)
- Upcoming/Past sections ✅
- AlertItemCard with type icon, title, time ✅
- Long-press → ChitActionMenu ✅
- 30-second periodic reclassification ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Upcoming/Past sections | ✅ | ✅ | ✅ |
| Alert type icon | ✅ | ✅ (🔔/⏱/📌) | ✅ |
| Chit title | ✅ | ✅ | ✅ |
| Scheduled time | ✅ | ✅ | ✅ |
| Tap opens editor | ✅ | ✅ | ✅ |
| Snooze button (inline, not long-press) | ✅ | ❌ only via long-press menu | ❌ |
| Dismiss button (inline) | ✅ | ❌ | ❌ |
| Independent alerts board | ✅ standalone alerts | ❌ | ❌ |
| Stopwatch display (running state) | ✅ | ❌ | ❌ |
| Timer countdown (live) | ✅ | ❌ | ❌ |
| 4 alert types | ✅ notification/alarm/timer/stopwatch | 💀 3 types with wrong names | 💀 |
| Filter integration | ✅ | 💀 filter collected but all alerts pass through unfiltered | 💀 |
| "List" vs "Independent" mode toggle | ✅ | ❌ | ❌ |

**View verdict: 💀 BROKEN** (no inline snooze/dismiss, no independent alerts, no stopwatch/timer display, wrong type names, filter is no-op, no mode toggle)

---

## 4.4 Indicators/Health Charts View

### Web (main-views-indicators.js)
- Line charts per indicator type (from settings.visual_indicators custom objects)
- Time range selector
- Tooltip on hover (value + date)
- Different colors per indicator type
- Add new reading button per type
- Chart legend

### Android (IndicatorsScreen.kt + IndicatorsViewModel.kt)
- TimeRangeSelector (7d/30d/90d/All) ✅
- LazyColumn of IndicatorChartCard ✅
- Canvas line chart with tap tooltip ✅
- Data from chitRepository.getIndicatorChits() → ChartDataTransformer

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Line charts per type | ✅ | ✅ Canvas path drawing | ✅ |
| Time range selector | ✅ | ✅ FilterChips | ✅ |
| Tooltip (value + date) | ✅ hover | ✅ tap (detectTapGestures + hitTest) | ✅ |
| Different colors per type | ✅ | ❌ all charts use Color(0xFF6B4E31) | ❌ |
| Add new reading button | ✅ per type | ❌ | ❌ |
| Chart legend | ✅ | ❌ | ❌ |
| Empty state | ✅ | ✅ "No health data yet" | ✅ |

**View verdict: 💀 BROKEN** (all charts same color, no add button, no legend)

---

## 4.5 Maps View

### Web
- OpenStreetMap embed with markers for all location-bearing chits
- Marker click opens chit editor
- Saved locations shown as markers
- Auto-zoom to fit all markers
- Map settings (default lat/lon/zoom from settings)
- Geocoding: text addresses resolved to coordinates for display

### Android (MapScreen.kt + MapViewModel.kt)
- osmdroid MapView with MAPNIK tiles ✅
- Markers from chit locations ✅
- Marker tap → onNavigateToEditor ✅
- My-location overlay + FAB ✅
- Location permission request ✅
- Auto-zoom (zoomToBoundingBox) ✅

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Map renders with OSM tiles | ✅ | ✅ | ✅ |
| Markers for location chits | ✅ | ✅ | ✅ |
| Marker tap opens editor | ✅ | ✅ | ✅ |
| Auto-zoom to fit markers | ✅ | ✅ | ✅ |
| My-location button | ✅ | ✅ FAB | ✅ |
| Saved locations as markers | ✅ | ❌ only chit locations | ❌ |
| Map settings (default lat/lon/zoom) | ✅ from settings | ❌ hardcoded zoom=12 | ❌ |
| Geocoding text addresses | ✅ resolves "123 Main St" to lat/lng | ❌ only parses JSON/comma lat,lng | ❌ |
| Empty state | ✅ | ✅ "No locations to display" | ✅ |

**View verdict: 💀 BROKEN** (most chits store text addresses that aren't geocoded → most markers never appear. Also missing saved locations and settings integration.)

---

## 4.6 Widgets

### Web
- N/A — widgets are Android-only, no web equivalent to compare against

### Android
- **QuickAddWidgetProvider** — tap opens editor in create mode
- **TodayCalendarWidgetProvider** — shows up to 5 today's events with time
- **UpcomingTasksWidgetProvider** — shows up to 5 ToDo/InProgress tasks with due dates
- **WidgetDataProvider** — reads Room DB directly
- **WidgetUpdateWorker** — periodic refresh (30 min) + immediate on sync

### Comparison

| Item | Expected | Android | Status |
|---|---|---|---|
| Quick Add (tap → new chit) | ✅ | 💀 Does not work on device | 💀 |
| Today Calendar (today's events) | ✅ | 💀 Does not work on device | 💀 |
| Upcoming Tasks (due soon) | ✅ | 💀 Does not work on device | 💀 |
| Tap item opens editor | ✅ | 💀 Does not work on device | 💀 |
| Periodic refresh | ✅ | 💀 Does not work on device | 💀 |
| Immediate refresh on data change | ✅ | 💀 Does not work on device | 💀 |

**View verdict: 💀 BROKEN** (none of the widgets function on device — code exists but doesn't work)

---

## Phase 4 Summary

| Section | Verdict |
|---|---|
| 4.1 Checklists View | 💀 BROKEN |
| 4.2 Projects/Kanban View | 💀 BROKEN |
| 4.3 Alerts View | 💀 BROKEN |
| 4.4 Indicators View | 💀 BROKEN |
| 4.5 Maps View | 💀 BROKEN |
| 4.6 Widgets | 💀 BROKEN |

---

## Complete Gap List (Phase 4)

1. **Checklists: no progress count on cards** — web shows "3/7 complete"
2. **Checklists: no tag chips on cards**
3. **Checklists: no chit color on cards** — hardcoded parchment instead of chit.color
4. **Checklists: no archive/snooze indicators on cards**
5. **Checklists: no quick-edit modal** — long-press opens action menu, not inline editor
6. **Checklists: no drag-to-reorder cards**
7. **Projects: no drag-drop between Kanban columns** — moveToColumn exists but no gesture
8. **Projects: child cards don't show due date**
9. **Projects: child cards don't have status dropdown**
10. **Projects: child cards don't have open/move/remove/delete buttons**
11. **Projects: no "Add existing chit" button**
12. **Projects: no "Create new child" button**
13. **Projects: no project progress bar**
14. **Alerts: no inline snooze button** — only via long-press menu
15. **Alerts: no inline dismiss button**
16. **Alerts: no independent alerts board** — standalone alerts not attached to chits
17. **Alerts: no stopwatch display**
18. **Alerts: no timer countdown display**
19. **Alerts: wrong type names** — alarm/timer/reminder vs notification/alarm/timer/stopwatch
20. **Alerts: filter is a no-op** — all alerts pass through regardless of filter state
21. **Alerts: no "List" vs "Independent" mode toggle**
22. **Indicators: all charts same color** — should be different per type
23. **Indicators: no "add new reading" button**
24. **Indicators: no chart legend**
25. **Maps: saved locations not shown as markers**
26. **Maps: no settings integration** — default lat/lon/zoom not applied
27. **Maps: text addresses not geocoded** — only JSON/comma lat,lng parsed; most chits invisible

**Total: 27 gaps + widgets non-functional on device (all 💀 BROKEN)**

28. **Widgets: none function on device** — code exists (providers, data provider, worker) but widgets don't actually work when added to home screen
