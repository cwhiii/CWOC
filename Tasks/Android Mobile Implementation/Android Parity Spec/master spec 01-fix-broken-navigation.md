# Phase 1: Fix Broken Navigation

## Problem
Three things are actively broken right now:
1. **Indicators screen is unreachable** — not in C CAPTN tab row, not in sidebar
2. **Audit Log** — sidebar link exists but no composable registered in NavGraph (crash)
3. **Custom Objects** — sidebar link exists but no composable registered in NavGraph (crash)

## Tasks

### 1.1 Add Indicators to the C CAPTN Tab Row
**File:** `android/app/src/main/java/com/cwoc/app/ui/navigation/CCaptnTabRow.kt`

The web has Indicators as a tab in the main tab bar. Add it to the `CCaptnTab` enum:
```kotlin
enum class CCaptnTab(val label: String, val route: String, val icon: ImageVector) {
    Calendar("Calendar", "calendar", Icons.Default.CalendarMonth),
    Checklists("Checklists", "checklists", Icons.Default.Checklist),
    Alarms("Alerts", "alarms", Icons.Default.Alarm),
    Projects("Projects", "projects", Icons.Default.Folder),
    Tasks("Tasks", "tasks", Icons.Default.Task),
    Notes("Notes", "notes", Icons.Default.Notes),
    Indicators("Indicators", "indicators", Icons.Default.ShowChart)  // ADD THIS
}
```

Also add `Screen.Indicators.route` to the `cCaptnRoutes` set in `MainActivity.kt` so it gets the full nav chrome (drawer + top bar + tabs).

### 1.2 Register Audit Log Screen in NavGraph
**File:** `android/app/src/main/java/com/cwoc/app/ui/navigation/CwocNavGraph.kt`

Create a placeholder screen at `android/app/src/main/java/com/cwoc/app/ui/screens/auditlog/AuditLogScreen.kt` that:
- Shows a top bar with "Audit Log" title and back button
- Fetches audit entries from `/api/audit` (GET, returns JSON array)
- Displays entries in a LazyColumn with: timestamp, actor, action, entity_type, entity_id, changes summary
- Has filter chips for entity type (All, Chits, Contacts, Settings, System)
- Has a date range picker (start/end)

Register it in the NavGraph:
```kotlin
composable(Screen.AuditLog.route) {
    AuditLogScreen(onNavigateBack = { navController.popBackStack() })
}
```

### 1.3 Register Custom Objects Screen in NavGraph
**File:** `android/app/src/main/java/com/cwoc/app/ui/navigation/CwocNavGraph.kt`

Create a screen at `android/app/src/main/java/com/cwoc/app/ui/screens/customobjects/CustomObjectsScreen.kt` that:
- Shows a top bar with "Custom Objects" title and back button
- Fetches custom object definitions from `/api/custom-objects` (GET)
- Lists each custom object type with its fields
- Allows creating new custom object types (name + field definitions)
- Allows editing existing types (add/remove/rename fields)
- Allows deleting types (with confirmation)

Register it in the NavGraph:
```kotlin
composable(Screen.CustomObjects.route) {
    CustomObjectsScreen(onNavigateBack = { navController.popBackStack() })
}
```

### 1.4 Add Indicators route to cCaptnRoutes
**File:** `android/app/src/main/java/com/cwoc/app/MainActivity.kt`

Add `Screen.Indicators.route` to the `cCaptnRoutes` set so the Indicators screen gets the full navigation chrome (drawer, top bar, tab row):
```kotlin
val cCaptnRoutes = setOf(
    Screen.Tasks.route,
    Screen.Notes.route,
    Screen.Calendar.route,
    Screen.Checklists.route,
    Screen.Alarms.route,
    Screen.Projects.route,
    Screen.Indicators.route  // ADD THIS
)
```

## Verification
After this phase:
- [ ] Indicators tab appears in the C CAPTN tab row and is tappable
- [ ] Tapping Indicators shows the charts screen with full nav chrome
- [ ] Tapping "Audit Log" in sidebar navigates to a working screen (no crash)
- [ ] Tapping "Custom Objects" in sidebar navigates to a working screen (no crash)
- [ ] All three screens have back navigation that works

## Web Reference Files
- `src/frontend/js/dashboard/main-views-indicators.js` — Indicators view logic
- `src/frontend/html/audit-log.html` — Audit log page (inline JS)
- `src/frontend/html/custom-objects-editor.html` — Custom objects editor
