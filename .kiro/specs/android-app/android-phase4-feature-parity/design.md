# Design Document: Android Phase 4 — Feature Parity & Polish

## Overview

Phase 4 adds the remaining C CAPTN views, map integration, home screen widgets, gesture interactions, boolean search, recurrence expansion, animations, and a contact list screen to the CWOC Android app. This document covers only what's new — Phase 1-3 architecture (Room, Hilt, Retrofit, sync engine, dirty tracking, WorkManager) is assumed in place.

## Architecture

### New Packages

```
android/app/src/main/java/com/cwoc/app/
  ui/screens/
    checklists/          # Checklists view (ViewModel + Composables)
    projects/            # Projects/Kanban view
    alerts/              # Alerts/Alarms view
    indicators/          # Indicators/Charts view
    map/                 # Map screen (osmdroid integration)
    contacts/            # Contact list screen
  ui/components/
    chart/               # Canvas chart components
    swipe/               # Swipe-to-action components
    drag/                # Drag-and-drop utilities
    widget/              # Widget data providers
  domain/
    search/              # Boolean search parser + evaluator
    recurrence/          # Recurrence expansion engine (Kotlin port)
    chart/               # Chart data transformation
  widget/
    quickadd/            # Quick Add widget (RemoteViews)
    calendar/            # Today Calendar widget
    tasks/               # Upcoming Tasks widget
    refresh/             # Widget refresh WorkManager job
```

### New Resource Directories

```
android/app/src/main/res/
  layout/
    widget_quick_add.xml
    widget_today_calendar.xml
    widget_today_calendar_item.xml
    widget_upcoming_tasks.xml
    widget_upcoming_tasks_item.xml
  xml/
    widget_quick_add_info.xml
    widget_today_calendar_info.xml
    widget_upcoming_tasks_info.xml
  drawable/
    widget_background.xml        # Parchment rounded rect
    swipe_archive_background.xml # Green background
    swipe_snooze_background.xml  # Orange background
```

## Components and Interfaces

### 1. Boolean Search Engine

The search system parses boolean queries into an AST and evaluates them against chit fields.

```kotlin
// domain/search/BooleanSearchParser.kt

sealed class SearchNode {
    data class Term(val value: String) : SearchNode()
    data class And(val left: SearchNode, val right: SearchNode) : SearchNode()
    data class Or(val left: SearchNode, val right: SearchNode) : SearchNode()
    data class Not(val operand: SearchNode) : SearchNode()
}

class BooleanSearchParser {
    /**
     * Parses a query string into a SearchNode AST.
     * Supports: AND (space or keyword), OR, NOT (prefix "-" or keyword), parentheses.
     * Returns null for empty/whitespace-only input.
     */
    fun parse(query: String): SearchNode?
}

class BooleanSearchEvaluator {
    /**
     * Evaluates a SearchNode against a chit's searchable text fields.
     * Searches across: title, note, tags (joined), checklist item text.
     * Case-insensitive matching.
     */
    fun matches(node: SearchNode, chit: ChitEntity): Boolean

    /**
     * Extracts all searchable text from a chit into a single lowercase string
     * for efficient matching.
     */
    fun extractSearchableText(chit: ChitEntity): String
}
```

### 2. Recurrence Engine

Kotlin port of `shared-recurrence.js`. Pure functions, no Android dependencies.

```kotlin
// domain/recurrence/RecurrenceEngine.kt

data class RecurrenceRule(
    val freq: Frequency,        // DAILY, WEEKLY, MONTHLY, YEARLY
    val interval: Int = 1,
    val byDay: List<DayOfWeek> = emptyList(),
    val byMonthDay: Int? = null,
    val bySetPos: Int? = null,  // ordinal weekday (e.g., 2 = second)
    val until: LocalDate? = null,
    val count: Int? = null
)

enum class Frequency { DAILY, WEEKLY, MONTHLY, YEARLY }

data class RecurrenceException(
    val date: LocalDate,
    val brokenOff: Boolean = false,
    val completed: Boolean = false,
    val title: String? = null,
    val startDatetime: LocalDateTime? = null,
    val endDatetime: LocalDateTime? = null
)

data class RecurrenceInstance(
    val date: LocalDate,
    val startDatetime: LocalDateTime?,
    val endDatetime: LocalDateTime?,
    val instanceNum: Int,
    val isCompleted: Boolean = false,
    val overrides: Map<String, Any?> = emptyMap()
)

class RecurrenceEngine {
    /**
     * Expands a recurrence rule into concrete instances within a date range.
     * Respects exceptions (broken-off dates excluded, completed dates marked).
     * Timezone-aware: anchored chits expand in their stored timezone.
     */
    fun expand(
        rule: RecurrenceRule,
        baseDate: LocalDateTime,
        rangeStart: LocalDate,
        rangeEnd: LocalDate,
        exceptions: List<RecurrenceException> = emptyList(),
        timezone: ZoneId = ZoneId.systemDefault()
    ): List<RecurrenceInstance>

    /**
     * Formats a recurrence rule as a human-readable string.
     * e.g., "Every 2 weeks on Mon, Wed"
     */
    fun formatRule(rule: RecurrenceRule): String
}
```

### 3. Canvas Chart System

Custom Compose Canvas rendering for indicator charts. No external charting library.

```kotlin
// domain/chart/ChartDataTransformer.kt

data class ChartDataPoint(
    val date: LocalDate,
    val value: Float,
    val label: String? = null
)

data class ChartConfig(
    val timeRange: TimeRange,
    val chartType: ChartType = ChartType.LINE,
    val yAxisMin: Float? = null,  // auto-computed if null
    val yAxisMax: Float? = null
)

enum class TimeRange { DAYS_7, DAYS_30, DAYS_90, ALL_TIME }
enum class ChartType { LINE, BAR, SPARKLINE }

class ChartDataTransformer {
    /**
     * Filters data points to the selected time range.
     */
    fun filterByRange(points: List<ChartDataPoint>, range: TimeRange, today: LocalDate): List<ChartDataPoint>

    /**
     * Maps data points to pixel coordinates within a given canvas size.
     * Returns pairs of (x, y) in pixels.
     */
    fun mapToPixels(
        points: List<ChartDataPoint>,
        canvasWidth: Float,
        canvasHeight: Float,
        padding: Float = 32f
    ): List<Pair<Float, Float>>

    /**
     * Hit-tests a tap coordinate against rendered data points.
     * Returns the index of the nearest point within a tap radius, or -1.
     */
    fun hitTest(
        tapX: Float,
        tapY: Float,
        pointPixels: List<Pair<Float, Float>>,
        tapRadius: Float = 24f
    ): Int
}

// ui/components/chart/CanvasChart.kt — Compose Canvas composable
@Composable
fun CanvasLineChart(
    points: List<ChartDataPoint>,
    config: ChartConfig,
    onPointTapped: ((ChartDataPoint) -> Unit)? = null,
    modifier: Modifier = Modifier
)
```

### 4. Kanban Board

```kotlin
// ui/screens/projects/KanbanColumn.kt

enum class KanbanStatus(val label: String) {
    TODO("ToDo"),
    IN_PROGRESS("In Progress"),
    BLOCKED("Blocked"),
    COMPLETE("Complete")
}

/**
 * Maps a chit status string to a KanbanStatus enum.
 * Unknown statuses default to TODO.
 */
fun String.toKanbanStatus(): KanbanStatus

/**
 * Groups child chits by their KanbanStatus.
 * Returns a map with all four columns (empty lists for columns with no chits).
 */
fun groupByKanbanStatus(childChits: List<ChitEntity>): Map<KanbanStatus, List<ChitEntity>>
```

### 5. Widget Architecture

Widgets use `RemoteViews` XML layouts (not Compose — Compose Glance is optional/future). Data comes exclusively from Room via a `WidgetDataProvider`.

```kotlin
// widget/refresh/WidgetDataProvider.kt

class WidgetDataProvider @Inject constructor(
    private val chitDao: ChitDao
) {
    /** Returns today's calendar chits sorted by start time. */
    suspend fun getTodayCalendarChits(today: LocalDate): List<ChitEntity>

    /** Returns up to 5 upcoming tasks (ToDo/In Progress) sorted by due date. */
    suspend fun getUpcomingTasks(limit: Int = 5): List<ChitEntity>
}

// widget/refresh/WidgetUpdateWorker.kt

class WidgetUpdateWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    /**
     * Refreshes all active widget instances from Room data.
     * Scheduled as periodic (30 min) + triggered on sync/edit events.
     */
    override suspend fun doWork(): Result
}
```

### 6. Swipe Actions

```kotlin
// ui/components/swipe/SwipeActionState.kt

data class SwipeActionResult(
    val chitId: String,
    val previousState: ChitEntity,  // snapshot for undo
    val action: SwipeActionType
)

enum class SwipeActionType { ARCHIVE, SNOOZE }

/**
 * Applies an archive action: sets status to "Complete", marks dirty.
 * Returns a SwipeActionResult for undo support.
 */
suspend fun applyArchive(chitDao: ChitDao, chitId: String): SwipeActionResult

/**
 * Applies a snooze action: adds a reminder alert at now + duration, marks dirty.
 * Returns a SwipeActionResult for undo support.
 */
suspend fun applySnooze(chitDao: ChitDao, chitId: String, duration: Duration): SwipeActionResult

/**
 * Reverts a swipe action using the stored previous state.
 * Clears dirty flag if no other pending changes exist.
 */
suspend fun undoSwipeAction(chitDao: ChitDao, result: SwipeActionResult)
```

### 7. Map Integration (osmdroid)

```kotlin
// ui/screens/map/MapScreen.kt

/**
 * Wraps osmdroid MapView in an AndroidView composable.
 * Configures: custom user-agent, tile cache (100MB), markers from chit data.
 */
@Composable
fun MapScreen(
    viewModel: MapViewModel,
    onChitSelected: (String) -> Unit  // navigate to editor
)

// ui/screens/map/MapViewModel.kt

class MapViewModel @Inject constructor(
    private val chitDao: ChitDao
) : ViewModel() {
    /** All non-deleted chits with lat/lng values. */
    val markerChits: StateFlow<List<ChitEntity>>

    /** Computes bounding box encompassing all markers. */
    fun computeBounds(chits: List<ChitEntity>): BoundingBox?

    /** Resolves marker color: chit.color or default #6b4e31. */
    fun markerColor(chit: ChitEntity): Int
}
```

### 8. Checklist Nesting & Reorder

```kotlin
// domain/checklist/ChecklistOperations.kt

data class ChecklistItem(
    val id: String,
    val text: String,
    val checked: Boolean,
    val indent: Int  // 0, 1, or 2 (three levels)
)

/**
 * Toggles the checked state of an item by ID.
 * Returns the new checklist list (immutable transformation).
 */
fun toggleChecklistItem(items: List<ChecklistItem>, itemId: String): List<ChecklistItem>

/**
 * Moves an item from sourceIndex to destIndex within the list.
 * Preserves indent levels. Returns the reordered list.
 */
fun reorderChecklistItem(items: List<ChecklistItem>, sourceIndex: Int, destIndex: Int): List<ChecklistItem>

/**
 * Computes the indentation pixel offset for a given nesting level.
 */
fun indentationDp(level: Int): Int = level * 24
```

### 9. Alert Classification

```kotlin
// domain/alerts/AlertClassifier.kt

data class ClassifiedAlert(
    val chitId: String,
    val chitTitle: String,
    val alertType: String,  // "alarm", "reminder", "timer"
    val scheduledTime: LocalDateTime,
    val section: AlertSection
)

enum class AlertSection { UPCOMING, PAST }

/**
 * Classifies alerts into Upcoming/Past based on comparison to referenceTime.
 * Sorts by scheduledTime ascending within each section.
 */
fun classifyAlerts(
    chits: List<ChitEntity>,
    referenceTime: LocalDateTime = LocalDateTime.now()
): List<ClassifiedAlert>
```

### 10. Contact List

```kotlin
// ui/screens/contacts/ContactListViewModel.kt

class ContactListViewModel @Inject constructor(
    private val contactDao: ContactDao
) : ViewModel() {
    val contacts: StateFlow<List<ContactEntity>>
    val searchQuery: MutableStateFlow<String>
    val filteredContacts: StateFlow<List<ContactEntity>>

    /**
     * Computes alphabetical section headers from the contact list.
     * Returns distinct first letters present in contact names.
     */
    fun computeSectionIndex(contacts: List<ContactEntity>): List<Char>

    /**
     * Filters contacts by name, email, or phone containing the query.
     * Case-insensitive.
     */
    fun filterContacts(contacts: List<ContactEntity>, query: String): List<ContactEntity>
}
```

### 11. Dirty Tracking Extension

Phase 4 operations that mutate chits must integrate with the existing dirty tracking system:

```kotlin
/**
 * Marks a ChitEntity as dirty with the specified field added to dirty_fields.
 * If the chit is already dirty, appends the field to the existing dirty_fields list.
 */
suspend fun ChitDao.markDirty(chitId: String, field: String)
```

Operations that trigger dirty marking:
- Checklist toggle/reorder → field: `"checklist"`
- Kanban drag (status change) → field: `"status"`
- Swipe archive → field: `"status"`
- Swipe snooze → field: `"alerts"`

### 12. Database Migration v3 → v4

```kotlin
// data/local/Migration3To4.kt

val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(db: SupportSQLiteDatabase) {
        // Add indexes for efficient view queries
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_chit_has_checklist ON chits(id) WHERE checklist IS NOT NULL")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_chit_has_children ON chits(id) WHERE child_chits IS NOT NULL")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_chit_has_alerts ON chits(id) WHERE alerts IS NOT NULL")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_chit_has_health ON chits(id) WHERE health_data IS NOT NULL")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_chit_has_location ON chits(id) WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_contact_name ON contacts(name COLLATE NOCASE)")
    }
}
```

### 13. Pull-to-Refresh Integration

All list screens wrap their content in `PullToRefreshBox` (Material 3):

```kotlin
@Composable
fun PullToRefreshListScreen(
    syncState: SyncState,
    onRefresh: () -> Unit,
    content: @Composable () -> Unit
)
```

The `onRefresh` callback triggers `SyncPullEngine.pull()` from the existing Phase 2-3 sync infrastructure. The `SyncState` sealed class drives the loading indicator and error toast.

### 14. Navigation Update

The bottom nav bar expands from 3 tabs (Phase 1) to 6 tabs (full C CAPTN):

```kotlin
enum class CaptainTab(val label: String, val icon: ImageVector, val route: String) {
    CALENDAR("Calendar", Icons.Default.CalendarMonth, "calendar"),
    CHECKLISTS("Checklists", Icons.Default.Checklist, "checklists"),
    ALARMS("Alarms", Icons.Default.Alarm, "alarms"),
    PROJECTS("Projects", Icons.Default.ViewKanban, "projects"),
    TASKS("Tasks", Icons.Default.Task, "tasks"),
    NOTES("Notes", Icons.Default.Note, "notes")
}
```

Each tab preserves its own scroll position and filter state via `rememberSaveable` in the respective ViewModel.

### 15. Animations

All transitions use Compose animation APIs:

| Context | API | Duration |
|---------|-----|----------|
| Screen navigation | `AnimatedNavHost` with `fadeIn`/`fadeOut` | 250ms |
| List item add | `AnimatedVisibility` + `slideInVertically` + `fadeIn` | 300ms |
| List item remove | `AnimatedVisibility` + `slideOutHorizontally` + `fadeOut` | 250ms |
| Drag feedback | `graphicsLayer { scaleX/Y = 1.05f; shadowElevation = 8.dp }` | — |
| Drop settle | `animateItemPlacement()` on `LazyColumn` | 200ms |
| Content resize | `animateContentSize()` | 200ms |

### 16. Widget Update Triggers

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Sync Pull      │────▶│  WidgetRefreshEvent  │────▶│  WidgetUpdate   │
│  completes      │     │  (broadcast)         │     │  Worker (immed) │
├─────────────────┤     └──────────────────────┘     └─────────────────┘
│  Chit CRUD      │────▶         ▲
│  (local edit)   │              │
├─────────────────┤     ┌────────┴─────────────┐
│  Periodic       │────▶│  WorkManager         │
│  (30 min)       │     │  PeriodicWorkRequest │
└─────────────────┘     └──────────────────────┘
```

## Data Models

### ChitEntity Extensions (Phase 4 queries)

The existing `ChitEntity` from Phase 1-3 already contains all necessary fields (`checklist`, `child_chits`, `alerts`, `health_data`, `latitude`, `longitude`, `color`, `recurrence_rule`, `recurrence_exceptions`, `status`). Phase 4 adds no new columns — only new indexes for efficient filtered queries.

### New Domain Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `SearchNode` | Boolean search AST | `Term`, `And`, `Or`, `Not` variants |
| `RecurrenceRule` | Recurrence definition | `freq`, `interval`, `byDay`, `until`, `count` |
| `RecurrenceInstance` | Expanded occurrence | `date`, `startDatetime`, `instanceNum`, `isCompleted` |
| `ChartDataPoint` | Single chart value | `date`, `value`, `label` |
| `ChartConfig` | Chart display settings | `timeRange`, `chartType` |
| `ChecklistItem` | Nested checklist entry | `id`, `text`, `checked`, `indent` |
| `ClassifiedAlert` | Alert with section | `chitId`, `alertType`, `scheduledTime`, `section` |
| `KanbanStatus` | Column enum | `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE` |
| `SwipeActionResult` | Undo snapshot | `chitId`, `previousState`, `action` |

## Data Flow

### Chit Filtering for Views

All four new views (Checklists, Projects, Alerts, Indicators) follow the same pattern:

```
Room DB → DAO query (filtered) → ViewModel (StateFlow) → Composable (LazyColumn/Canvas)
```

Each DAO provides a specialized `Flow<List<ChitEntity>>` query:
- `getChecklistChits()` — WHERE checklist IS NOT NULL AND deleted = 0
- `getProjectChits()` — WHERE child_chits IS NOT NULL AND deleted = 0
- `getAlertChits()` — WHERE alerts IS NOT NULL AND deleted = 0
- `getIndicatorChits()` — WHERE health_data IS NOT NULL AND deleted = 0
- `getLocationChits()` — WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted = 0

### Widget Data Flow

```
Room DB → WidgetDataProvider → RemoteViews → AppWidgetManager.updateAppWidget()
```

Widgets never make network calls. They read from the local Room database only.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Pull-to-refresh fails (offline) | Toast: "Offline — showing cached data" |
| Map tiles fail to load | osmdroid shows cached tiles or blank with retry |
| Recurrence expansion hits max iterations (365) | Stops expanding, shows available instances |
| Widget data query fails | Widget shows last known data (stale) |
| Boolean search parse error | Treats entire input as a single term (graceful fallback) |
| Drag-drop target invalid | Animate item back to original position |

## Testing Strategy

**Property-based tests** (Kotlin + Kotest property testing or jqwik):
- Boolean search parser + evaluator (Properties 20-23)
- Recurrence engine (Properties 24-26)
- Chart data transformer (Properties 11-13)
- Checklist operations (Properties 2-4)
- Alert classification (Property 8)
- Kanban grouping (Properties 6-7)
- Contact filtering/sorting (Properties 27-28)
- Widget data queries (Properties 17-18)

**Unit tests** (example-based):
- Navigation tab existence and routing
- Widget layout and tap intents
- Marker popup content
- Swipe gesture visual feedback colors
- Animation duration configuration
- Database migration schema changes

**Integration tests**:
- Widget refresh triggered by sync events
- Pull-to-refresh end-to-end flow
- osmdroid configuration (user-agent, cache size)
- WorkManager periodic scheduling

Tests are optional per project conventions — they should be written but are not blockers.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Checklist filter correctness

*For any* set of ChitEntity records in the database, the Checklists_View SHALL display exactly those chits where checklist data is non-null and deleted is false — no more, no fewer.

**Validates: Requirements 1.2**

### Property 2: Checklist toggle is an involution

*For any* checklist item, toggling its checked state twice SHALL return it to its original checked state.

**Validates: Requirements 1.3**

### Property 3: Checklist indentation matches nesting depth

*For any* checklist item with nesting level N (0 ≤ N ≤ 2), the computed indentation SHALL equal N × 24dp.

**Validates: Requirements 1.4**

### Property 4: Checklist reorder preserves all items

*For any* checklist and any valid source/destination index pair, reordering SHALL produce a list containing exactly the same items (same IDs, same checked states) in a different order, with the moved item at the destination index.

**Validates: Requirements 1.5**

### Property 5: Mutation marks chit dirty with correct field

*For any* ChitEntity and any mutation operation (checklist toggle, checklist reorder, Kanban drag, swipe archive, swipe snooze), the operation SHALL set `is_dirty = true` and include the correct field name in `dirty_fields`.

**Validates: Requirements 1.6, 2.4, 10.1, 10.3**

### Property 6: Kanban column assignment matches status

*For any* child chit with a status field value, `groupByKanbanStatus` SHALL place it in the column whose label matches that status. Unknown statuses SHALL map to the TODO column.

**Validates: Requirements 2.3**

### Property 7: Kanban column counts are accurate

*For any* set of child chits grouped by status, the count badge for each Kanban column SHALL equal the length of that column's chit list.

**Validates: Requirements 2.6**

### Property 8: Alert classification partitions correctly

*For any* set of alert chits and a reference time T, `classifyAlerts` SHALL place alerts with scheduledTime > T in UPCOMING and alerts with scheduledTime ≤ T in PAST, sorted by scheduledTime ascending within each section.

**Validates: Requirements 3.2, 3.3**

### Property 9: Alert display contains required fields

*For any* ClassifiedAlert, the rendered output SHALL contain the alert type, scheduled time, and chit title.

**Validates: Requirements 3.5**

### Property 10: Indicator grouping produces one chart per type

*For any* set of ChitEntity records with health_data, the Indicators_View SHALL produce exactly one chart for each distinct indicator key present across all records.

**Validates: Requirements 4.2**

### Property 11: Chart coordinate mapping preserves order

*For any* list of ChartDataPoints sorted by date, `mapToPixels` SHALL produce x-coordinates in strictly non-decreasing order.

**Validates: Requirements 4.4**

### Property 12: Chart hit-test returns nearest point

*For any* tap coordinate within tap radius of exactly one data point, `hitTest` SHALL return that point's index. For taps outside all radii, it SHALL return -1.

**Validates: Requirements 4.5**

### Property 13: Chart time range filter is correct

*For any* set of data points and a selected TimeRange, `filterByRange` SHALL return exactly those points whose date falls within [today - range, today].

**Validates: Requirements 4.6**

### Property 14: Map markers match location-bearing chits

*For any* set of ChitEntity records, the map SHALL display markers for exactly those non-deleted chits that have both latitude and longitude non-null.

**Validates: Requirements 5.3**

### Property 15: Marker color resolution

*For any* ChitEntity with a non-null color field, the marker color SHALL be that color. For any ChitEntity with a null color field, the marker color SHALL be #6b4e31.

**Validates: Requirements 5.4**

### Property 16: Map bounds encompass all markers

*For any* set of geo-located chits, the computed bounding box SHALL contain all marker coordinates (every lat/lng pair falls within the box).

**Validates: Requirements 5.6**

### Property 17: Today calendar widget shows correct chits

*For any* set of ChitEntity records and a given date D, the Today_Calendar_Widget SHALL display exactly those chits with a date matching D, sorted by start time ascending.

**Validates: Requirements 7.2**

### Property 18: Upcoming tasks widget filter and sort

*For any* set of ChitEntity records, the Upcoming_Tasks_Widget SHALL display at most 5 non-deleted chits with status "ToDo" or "In Progress", sorted by due date ascending.

**Validates: Requirements 8.2**

### Property 19: Swipe undo is a round-trip

*For any* ChitEntity, applying a swipe action (archive or snooze) and then immediately undoing it SHALL restore the chit to its exact previous state.

**Validates: Requirements 10.5**

### Property 20: Boolean AND semantics

*For any* set of chits and any AND query with terms T1 and T2, every chit in the result set SHALL contain both T1 and T2 in its searchable text, and every chit NOT in the result set SHALL be missing at least one of T1 or T2.

**Validates: Requirements 11.2**

### Property 21: Boolean OR semantics

*For any* set of chits and any OR query with terms T1 and T2, every chit in the result set SHALL contain at least one of T1 or T2, and every chit NOT in the result set SHALL contain neither.

**Validates: Requirements 11.3**

### Property 22: Boolean NOT semantics

*For any* set of chits and any NOT query excluding term T, no chit in the result set SHALL contain T in its searchable text.

**Validates: Requirements 11.4**

### Property 23: Boolean search multi-field coverage

*For any* chit where a term appears in title, note, tags, or checklist text, a search for that term SHALL include that chit in results.

**Validates: Requirements 11.6**

### Property 24: Recurrence engine equivalence with JS

*For any* valid RecurrenceRule, base date, date range, and exception set, the Kotlin RecurrenceEngine SHALL produce the same set of instance dates as the web app's `shared-recurrence.js` `expandRecurrence` function given identical inputs.

**Validates: Requirements 12.1, 12.2, 12.3, 12.8**

### Property 25: Weekly recurrence respects byDay

*For any* weekly recurrence rule with byDay specified, every generated instance SHALL fall on one of the specified days of the week.

**Validates: Requirements 12.4**

### Property 26: Recurrence exceptions are excluded

*For any* recurrence rule with broken-off exception dates, no generated instance SHALL have a date matching any broken-off exception.

**Validates: Requirements 12.6**

### Property 27: Contact list is alphabetically sorted with correct section index

*For any* set of non-deleted contacts, the Contact_List_Screen SHALL display them sorted alphabetically by name (case-insensitive), and the section index SHALL contain exactly the distinct uppercase first letters present in the sorted list.

**Validates: Requirements 14.2, 14.5**

### Property 28: Contact search filters correctly

*For any* set of contacts and a search query Q, the filtered list SHALL contain exactly those contacts where name, email, or phone contains Q (case-insensitive).

**Validates: Requirements 14.3**

### Property 29: Tab state preservation round-trip

*For any* tab with a scroll position and filter state, switching away to another tab and switching back SHALL restore the original scroll position and filter state.

**Validates: Requirements 15.3**

### Property 30: Database migration preserves all records

*For any* Room database at version 3 containing N chit records, M contact records, and settings, after migration to version 4, all N chits, M contacts, and settings SHALL remain accessible with identical field values.

**Validates: Requirements 16.2, 16.3**
