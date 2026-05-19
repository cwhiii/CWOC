# Design Document: Android Parity Remaining Gaps

## Overview

This design addresses 23 remaining parity gaps between the CWOC Android app and the web mobile browser version. The implementation leverages existing architecture patterns (MVVM + Hilt + Compose + Room) and available dependencies (Coil 2.6.0, osmdroid 6.1.18, Compose Canvas APIs, gesture APIs).

## Architecture Patterns Used

- **UI Layer**: Jetpack Compose composables with state hoisting
- **State Management**: ViewModels with StateFlow, collected as Compose state
- **Data Layer**: Room DAOs → Repositories → ViewModels
- **DI**: Hilt @Inject constructors, @HiltViewModel, @Module providers
- **Image Loading**: Coil `AsyncImage` with auth headers
- **Gestures**: `detectDragGestures`, `detectDragGesturesAfterLongPress`, `detectTransformGestures`
- **Maps**: osmdroid `MapView` wrapped in `AndroidView` composable

---

## Component Design

### Component 1: Point-in-Time Event Shape (Requirements 1, 2)

**Approach**: Create custom `GenericShape` clip paths matching the web CSS `clip-path: polygon(...)` values.

**Files Modified**:
- `ui/screens/calendar/CalendarTimeGrid.kt`

**Implementation**:

1. Define a `PointInTimeShape` as a `GenericShape` that draws the hexagonal clip-path:
   ```kotlin
   val PointInTimeShape = GenericShape { size, _ ->
       val notch = 8.dp.toPx()
       moveTo(notch, 0f)
       lineTo(size.width - notch, 0f)
       lineTo(size.width, size.height / 2f)
       lineTo(size.width - notch, size.height)
       lineTo(notch, size.height)
       lineTo(0f, size.height / 2f)
       close()
   }
   ```
2. Define a `BirthdayChipShape` as a `GenericShape` with concave notches:
   ```kotlin
   val BirthdayChipShape = GenericShape { size, _ ->
       val notch = 8.dp.toPx()
       moveTo(0f, 0f)
       lineTo(notch, size.height / 2f)
       lineTo(0f, size.height)
       lineTo(size.width, size.height)
       lineTo(size.width - notch, size.height / 2f)
       lineTo(size.width, 0f)
       close()
   }
   ```
3. In `DayEventCard`: when `info.isPointInTime` is true, replace `.clip(RoundedCornerShape(4.dp))` with `.clip(PointInTimeShape)` and add extra horizontal padding (12.dp) to match web's `padding-left: 12px; padding-right: 12px`.
4. In `WeekEventChip`: same conditional clip when the event is point-in-time. Pass `CalendarDateInfo` to `WeekEventChip` (currently not passed — add parameter).
5. In `AllDayEventChip`: detect birthday events by checking if `event.tags` contains "Birthday" or if the event source indicates a birthday. When true, use `BirthdayChipShape` and prepend 🎂 icon.
6. Birthday detection: parse `event.tags` JSON for "Birthday" tag, matching web's `calendarEventTitle()` birthday branch logic.

**Data Flow**: `CalendarDateInfo.isPointInTime` already computed → passed to card composables → conditionally applied shape.

---

### Component 2: Snap Grid Visual Overlay (Requirement 3)

**Approach**: Add a state variable `isDragActive` at the grid level. When any event is being dragged, render additional Canvas lines at snap intervals.

**Files Modified**:
- `ui/screens/calendar/CalendarTimeGrid.kt`

**Implementation**:

1. Hoist a `var isAnyEventDragging by remember { mutableStateOf(false) }` state in both `DayTimeGrid` and `WeekTimeGrid`.
2. Pass a callback `onDragStateChange: (Boolean) -> Unit` to `DayEventCard` and `WeekEventChip`. On `onDragStart` set true, on `onDragEnd`/`onDragCancel` set false.
3. In the grid's `Canvas` composable, when `isAnyEventDragging` is true, draw additional dashed horizontal lines at every `snapMinutes` interval:
   ```kotlin
   if (isAnyEventDragging) {
       val snapPx = (snapMinutes.toFloat() / 60f) * effectiveHourHeight.toPx()
       val snapColor = Color(0x336B4E31) // semi-transparent brown
       var y = 0f
       while (y <= size.height) {
           drawLine(snapColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f,
               pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f)))
           y += snapPx
       }
   }
   ```
4. Lines appear in Day, Week, Work Hours, and X-Day views (all use the same `DayTimeGrid` or `WeekTimeGrid` composables).

**Data Flow**: Drag state bubbles up from event card → grid composable → Canvas overlay renders conditionally.

---

### Component 3: Week View Horizontal Drag (Requirement 4)

**Approach**: Extend `WeekEventChip` with full 2D drag support (currently only has tap). Track both X and Y offsets, determine target day column from horizontal position.

**Files Modified**:
- `ui/screens/calendar/CalendarTimeGrid.kt`

**Implementation**:

1. Add `dragOffsetX` and `dragOffsetY` state to `WeekEventChip`. Add `isDragging` state.
2. Replace `detectTapGestures` with a combined gesture handler:
   - Short tap → `onTap()`
   - Long press + drag → enter drag mode with X+Y tracking
3. Pass `columnWidthPx: Float` and `dayIndex: Int` and `days: List<LocalDate>` to `WeekEventChip`.
4. On drag end, calculate:
   ```kotlin
   val dayDelta = (dragOffsetX / columnWidthPx).roundToInt()
   val targetDayIndex = (dayIndex + dayDelta).coerceIn(0, days.size - 1)
   val targetDate = days[targetDayIndex]
   val minuteDelta = snapToGrid((dragOffsetY / hourHeightPx * 60).toInt(), snapMinutes)
   ```
5. Call `onEventDragEnd` with the new start/end times on the target date.
6. During drag, highlight the target column with a semi-transparent overlay:
   ```kotlin
   if (isDragging) {
       val targetCol = (dayIndex + (dragOffsetX / columnWidthPx).roundToInt()).coerceIn(0, days.size - 1)
       // Parent draws highlight on targetCol
   }
   ```
7. Hoist `highlightedColumn` state to `WeekTimeGrid` and pass it down for rendering a colored overlay on the target day column.

**Data Flow**: Drag gesture → calculate day delta + time delta → persist via `onEventDragEnd` callback → ViewModel updates Room + API.

---

### Component 4: Profile Images on People Chips (Requirements 5, 16)

**Approach**: Extend `PeopleChipsRow` and `PeopleZone` to accept contact image URLs. Use Coil `AsyncImage` for rendering.

**Files Modified**:
- `ui/components/ChitCardEnhancements.kt` (PeopleChipsRow, PersonChip)
- `ui/screens/editor/ChitEditorScreen.kt` (PeopleZone)
- `ui/screens/tasks/TasksScreen.kt` (passes data to PeopleChipsRow)

**Implementation**:

1. Change `PeopleChipsRow` signature to accept `contactImages: Map<String, String?>` (name → imageUrl).
2. Change `PersonChip` to accept an optional `imageUrl: String?` parameter.
3. In `PersonChip`, when `imageUrl` is non-null, replace the initials `Box` with:
   ```kotlin
   AsyncImage(
       model = ImageRequest.Builder(LocalContext.current)
           .data("$serverUrl$imageUrl")
           .addHeader("Authorization", "Bearer $authToken")
           .crossfade(true)
           .build(),
       contentDescription = "$name avatar",
       modifier = Modifier.size(14.dp).clip(CircleShape),
       contentScale = ContentScale.Crop
   )
   ```
4. Fall back to the existing initials circle when `imageUrl` is null or loading fails (use Coil's `error` and `placeholder` parameters).
5. In `TasksScreen`, the ViewModel already has access to contacts. Build the `contactImages` map by matching people names to `ContactEntity.imageUrl`.
6. In `PeopleZone` (editor), the `contactColors` map already passes per-contact data. Add a parallel `contactImages: Map<String, String?>` parameter, populated from the same contacts data source.

**Data Flow**: ContactRepository → ViewModel builds name→imageUrl map → passed to composables → Coil loads images.

---

### Component 5: Rule Habits & Aggregate Bar (Requirements 6, 7, 8)

**Approach**: Add API call to `GET /api/rules?habit=true`, display rule habit cards in `HabitsView`, compute aggregate success rate bar.

**Files Modified**:
- `ui/screens/tasks/TasksScreen.kt` (HabitsView composable)
- `ui/screens/tasks/TasksViewModel.kt` (new state for rule habits)
- `data/remote/CwocApiService.kt` (new endpoint)

**Implementation**:

1. Add Retrofit endpoint:
   ```kotlin
   @GET("api/rules")
   suspend fun getHabitRules(@Query("habit") habit: Boolean = true): List<RuleHabitDto>
   ```
2. Define `RuleHabitDto`:
   ```kotlin
   data class RuleHabitDto(
       val id: String,
       val name: String,
       val description: String?,
       val habit_summary: HabitSummaryDto?
   )
   data class HabitSummaryDto(
       val current_status: String?, // "due", "met", "missed"
       val streak: Int?,
       val success_rate: Double? // 0.0 to 1.0
   )
   ```
3. In `TasksViewModel`, add:
   - `val ruleHabits: StateFlow<List<RuleHabitDto>>` — fetched on habits mode activation
   - `val habitsIncludeRules: StateFlow<Boolean>` — from sidebar state
   - `val habitsSuccessWindow: StateFlow<Int>` — from sidebar state (7, 30, 90, or -1)
4. In `HabitsView`, after chit habit sections, add a "🤖 Rule Habits" section:
   ```kotlin
   if (ruleHabits.isNotEmpty()) {
       item { Text("🤖 Rule Habits", style = ..., fontWeight = FontWeight.Bold) }
       items(ruleHabits, key = { it.id }) { rule ->
           RuleHabitCard(rule = rule, onClick = { onNavigateToRule(rule.id) })
       }
   }
   ```
5. `RuleHabitCard` composable: shows name, 🤖 badge, status pill (due/met/missed), streak 🔥, success rate 📈.
6. Aggregate success rate bar (when `habitsIncludeRules` is true):
   - Combine chit habit rates (from `calculateHistoricalSuccessRate`) with rule habit `success_rate` values
   - Display as a `LinearProgressIndicator` with label "📊 Combined Success Rate: X%"
   - Insert at the top of the habits list
7. Success window: pass `habitsSuccessWindow` to `calculateHistoricalSuccessRate` to limit the period entries evaluated. Filter `recurrence_exceptions` entries by date within the window.

**Data Flow**: API → DTO → ViewModel StateFlow → HabitsView composable renders both sections + aggregate bar.

---

### Component 6: Masonry Drag-to-Reorder (Requirements 9, 10, 11)

**Approach**: Create a `ReorderableStaggeredGrid` composable for Notes and Checklists. Reuse existing `ReorderableLazyColumn` for Projects.

**Files Modified**:
- `ui/components/ReorderableStaggeredGrid.kt` (new file)
- `ui/screens/tasks/TasksScreen.kt` (Notes view, Checklists view)
- `ui/screens/tasks/TasksViewModel.kt` (reorder API call)

**Implementation**:

1. **ReorderableStaggeredGrid** — Since `LazyVerticalStaggeredGrid` doesn't natively support drag-to-reorder, implement an overlay-based approach:
   - On long-press, capture the item's position and render a draggable copy as an overlay
   - Track finger position to determine the target drop index
   - On drop, call `onReorder(fromIndex, toIndex)` callback
   - Visual feedback: elevate dragged item, dim original position, show insertion indicator
   ```kotlin
   @Composable
   fun <T> ReorderableStaggeredGrid(
       items: List<T>,
       key: (T) -> Any,
       columns: StaggeredGridCells,
       onReorder: (fromIndex: Int, toIndex: Int) -> Unit,
       enabled: Boolean = true,
       modifier: Modifier = Modifier,
       itemContent: @Composable (item: T, isDragging: Boolean) -> Unit
   )
   ```
2. The composable uses `LazyVerticalStaggeredGrid` internally with `pointerInput` on each item for long-press detection.
3. During drag, a `Box` overlay at the finger position shows the dragged card with elevation.
4. Target index calculation: based on the center of the dragged item relative to other items' bounds (tracked via `onGloballyPositioned`).
5. **Projects**: Already uses a list layout — wrap with existing `ReorderableLazyColumn`.
6. **API persistence**: On reorder, call `PUT /api/chits/reorder` with `{ids: [ordered_id_list]}` — same endpoint used by web's `enableDragToReorder`.
7. Only enabled when sort mode is "manual" (matching web behavior).

**Data Flow**: Long-press → drag overlay → calculate target → onReorder callback → ViewModel calls API → Room updates sort_order field.

---

### Component 7: Email Enhancements (Requirements 12, 13, 14, 15)

**Approach**: Multiple targeted additions to the email feature set.

**Files Modified**:
- `ui/screens/email/EmailScreen.kt` (contact images, bundle drag)
- `ui/screens/email/EmailContextMenu.kt` (Add to Bundle)
- `ui/screens/email/AttachmentPreviewDialog.kt` (new file)
- `data/repository/ContactRepository.kt` (email lookup method)
- `data/local/dao/ContactDao.kt` (query by email)

**Sub-component 7a: Email Contact Image Lookup (Req 12)**:

1. Add DAO method:
   ```kotlin
   @Query("SELECT * FROM contacts WHERE emails LIKE '%' || :email || '%' AND deleted = 0 LIMIT 1")
   suspend fun findByEmail(email: String): ContactEntity?
   ```
2. Add repository method with in-memory cache:
   ```kotlin
   private val emailImageCache = ConcurrentHashMap<String, String?>()
   suspend fun getImageUrlForEmail(email: String): String? {
       return emailImageCache.getOrPut(email) {
           contactDao.findByEmail(email)?.imageUrl
       }
   }
   ```
3. In email card composable, resolve sender email → image URL → display with Coil `AsyncImage` (circular, 24dp). Fall back to initials avatar.

**Sub-component 7b: Bundle Tab Drag-to-Reorder (Req 13)**:

1. In `BundleToolbar.kt`, wrap the `ScrollableTabRow` items with long-press drag gesture detection.
2. Track drag offset horizontally. On drop, calculate target tab index from position.
3. Call `onBundleReorder(fromIndex, toIndex)` → ViewModel persists new order via API.
4. Visual feedback: dragged tab gets elevation + slight scale, other tabs shift to make room.

**Sub-component 7c: Attachment Tap-to-Preview (Req 14)**:

1. Create `AttachmentPreviewDialog.kt`:
   ```kotlin
   @Composable
   fun AttachmentPreviewDialog(
       attachment: EmailAttachment,
       serverUrl: String,
       authToken: String,
       onDismiss: () -> Unit,
       onOpenExternal: () -> Unit
   )
   ```
2. Content based on MIME type:
   - `image/*` → Coil `AsyncImage` with zoom/pan gesture support
   - `text/plain` → `Text` composable with scroll, monospace font
   - `application/pdf` → Android's `PdfRenderer` in a `Canvas` composable (page-by-page)
   - Other → "Cannot preview. Open with external app?" button → `Intent.ACTION_VIEW`
3. Header shows filename, size (formatted), MIME type badge.
4. Triggered from existing attachment list item tap handler.

**Sub-component 7d: "Add to Bundle" Context Menu (Req 15)**:

1. Add to `EmailContextMenu.kt`:
   ```kotlin
   DropdownMenuItem(
       text = { Text("Add to Bundle") },
       onClick = { onDismiss(); onAddToBundle() },
       leadingIcon = { Icon(Icons.Default.Folder, "Add to Bundle") }
   )
   ```
2. `onAddToBundle` callback shows a `BundlePickerDialog` — lists all bundles, highlights current bundle if any.
3. On selection, calls ViewModel method to update email's bundle assignment via API.

**Data Flow**: Email cards → resolve sender → cache lookup → display image. Bundle tabs → drag gesture → reorder API. Attachment tap → preview dialog → render by MIME type.

---

### Component 8: People Zone Full-Field Search (Requirement 17)

**Approach**: Ensure the existing `ContactDao.searchAll()` query searches across all fields, not just name.

**Files Modified**:
- `data/local/dao/ContactDao.kt` (verify/fix search query)
- `ui/screens/editor/ChitEditorScreen.kt` (PeopleZone search)

**Implementation**:

1. Verify `ContactDao.searchAll()` includes all fields matching web's `_contactMatchesFilter`:
   ```kotlin
   @Query("""
       SELECT * FROM contacts WHERE deleted = 0 AND (
           givenName LIKE '%' || :query || '%' OR
           surname LIKE '%' || :query || '%' OR
           displayName LIKE '%' || :query || '%' OR
           nickname LIKE '%' || :query || '%' OR
           organization LIKE '%' || :query || '%' OR
           socialContext LIKE '%' || :query || '%' OR
           emails LIKE '%' || :query || '%' OR
           phones LIKE '%' || :query || '%' OR
           addresses LIKE '%' || :query || '%' OR
           callSigns LIKE '%' || :query || '%' OR
           xHandles LIKE '%' || :query || '%' OR
           websites LIKE '%' || :query || '%' OR
           notes LIKE '%' || :query || '%' OR
           tags LIKE '%' || :query || '%'
       ) ORDER BY favorite DESC, displayName ASC
   """)
   fun searchAll(query: String): Flow<List<ContactEntity>>
   ```
2. In `PeopleZone`, the `suggestions` filter currently only checks `contactNames` (name strings). Change to use the full `ContactRepository.searchContacts(query)` flow, which delegates to the DAO above.
3. Display matching contacts regardless of which field matched — show the contact name in the suggestion list with a subtle indicator of what matched (e.g., "John Smith — john@email.com" if email matched).

**Data Flow**: User types in search → debounced query → ContactDao.searchAll → Flow emits results → PeopleZone shows suggestions.

---

### Component 9: Contact Editor Map Preview (Requirement 18)

**Approach**: Embed a small osmdroid `MapView` in the contact editor's address section when geocoded coordinates are available.

**Files Modified**:
- `ui/screens/contacts/ContactEditorScreen.kt`

**Implementation**:

1. Parse the contact's address JSON for `lat` and `lon` fields (geocoded coordinates stored by the backend).
2. When coordinates exist, render an inline map preview:
   ```kotlin
   @Composable
   fun ContactMapPreview(lat: Double, lon: Double, onTap: () -> Unit) {
       val context = LocalContext.current
       AndroidView(
           factory = { ctx ->
               MapView(ctx).apply {
                   Configuration.getInstance().userAgentValue = ctx.packageName
                   setTileSource(TileSourceFactory.MAPNIK)
                   controller.setZoom(15.0)
                   controller.setCenter(GeoPoint(lat, lon))
                   setMultiTouchControls(false) // static preview
                   val marker = Marker(this)
                   marker.position = GeoPoint(lat, lon)
                   marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                   overlays.add(marker)
               }
           },
           modifier = Modifier
               .fillMaxWidth()
               .height(150.dp)
               .clip(RoundedCornerShape(8.dp))
               .clickable { onTap() }
       )
   }
   ```
3. Place below the address field in the editor. On tap, open the full maps app (existing "Open in Maps" intent logic).
4. When no coordinates exist, hide the map preview entirely.
5. Disable touch interactions on the preview map (it's just a visual) — set `setMultiTouchControls(false)` and intercept touch events to route to the tap handler.

**Data Flow**: ContactEntity.addresses JSON → parse lat/lon → render MapView → tap opens external maps.

---

### Component 10: Rule Editor Condition Tree (Requirement 19)

**Approach**: Build a recursive composable that renders nested AND/OR condition groups matching the web's `renderConditionTree()` structure.

**Files Modified**:
- `ui/screens/rules/RuleEditorScreen.kt`
- `ui/screens/rules/RuleEditorViewModel.kt`
- `ui/screens/rules/ConditionTreeBuilder.kt` (new file)

**Implementation**:

1. Define data model matching web's JSON structure:
   ```kotlin
   sealed class ConditionNode {
       abstract val id: String
       data class Group(
           override val id: String = UUID.randomUUID().toString(),
           val operator: String = "AND", // "AND" or "OR"
           val children: MutableList<ConditionNode> = mutableListOf()
       ) : ConditionNode()
       data class Leaf(
           override val id: String = UUID.randomUUID().toString(),
           val field: String = "",
           val operator: String = "equals",
           val value: String = ""
       ) : ConditionNode()
   }
   ```
2. ViewModel holds `val conditionTree: MutableStateFlow<ConditionNode.Group>` — the root group.
3. Recursive composable:
   ```kotlin
   @Composable
   fun ConditionTreeBuilder(
       root: ConditionNode.Group,
       onTreeChange: (ConditionNode.Group) -> Unit,
       availableFields: List<FieldOption>
   )
   ```
4. `ConditionGroupView` composable:
   - AND/OR toggle (two buttons, active state highlighted)
   - Remove button (except root)
   - Renders each child via `ConditionNodeView` (recursive)
   - "+ Condition" and "+ Group" buttons at bottom
5. `ConditionLeafView` composable:
   - Field dropdown (from `availableFields`)
   - Operator dropdown (equals, contains, greater_than, etc.)
   - Value text field
   - Remove button (×)
6. Visual nesting: each group has a left border + indent (4.dp padding + 2.dp colored left border per nesting level).
7. Serialization: `_serializeTree()` strips internal IDs and produces the same JSON structure as the web app for API persistence.
8. Deserialization: `_deserializeTree()` adds internal IDs when loading from API.
9. Replace the current flat "Action Config (JSON)" text field with this tree builder for the conditions section.

**Data Flow**: ViewModel.conditionTree → ConditionTreeBuilder composable → user edits → onTreeChange updates ViewModel → serialize on save → API.

---

### Component 11: Clock Modal Analog Face (Requirement 20)

**Approach**: Add a Compose `Canvas` drawing above the existing digital time display in `ClockModal`.

**Files Modified**:
- `ui/components/ClockModal.kt`

**Implementation**:

1. Add `AnalogClockFace` composable using Compose Canvas:
   ```kotlin
   @Composable
   fun AnalogClockFace(now: ZonedDateTime, modifier: Modifier = Modifier) {
       Canvas(modifier = modifier.size(160.dp)) {
           val center = Offset(size.width / 2, size.height / 2)
           val radius = size.minDimension / 2 * 0.9f
           // Draw face circle
           drawCircle(Color(0xFFFDF5E6), radius, center)
           drawCircle(Color(0xFF6B4E31), radius, center, style = Stroke(2.dp.toPx()))
           // Hour markers (12 thick lines)
           for (i in 0 until 12) { /* draw thick line at angle */ }
           // Minute markers (60 thin lines, skip hours)
           for (i in 0 until 60) { if (i % 5 != 0) /* draw thin line */ }
           // Hour hand
           val hourAngle = (now.hour % 12 + now.minute / 60f) * 30f - 90f
           // draw thick short line from center
           // Minute hand
           val minuteAngle = (now.minute + now.second / 60f) * 6f - 90f
           // draw medium line from center
           // Second hand
           val secondAngle = now.second * 6f - 90f
           // draw thin long red line from center
           // Center dot
           drawCircle(Color(0xFF4A2C2A), 4.dp.toPx(), center)
       }
   }
   ```
2. Colors match web: parchment face (`#FDF5E6`), brown border/hands (`#6B4E31`), red second hand (`#C62828`).
3. Place above the timezone list in `ClockModal`. Show the local timezone's analog face.
4. The existing `LaunchedEffect` already updates `now` every second — reuse for animation.

**Data Flow**: `now` state (updated every 1s) → Canvas redraws hands at new angles.

---

### Component 12: Weather as Overlay Modal (Requirement 21)

**Approach**: `WeatherModal.kt` already exists as an `AlertDialog` overlay. Verify it's triggered correctly from the dashboard without navigation.

**Files Modified**:
- `ui/screens/dashboard/DashboardScreen.kt` (or equivalent main screen)
- Potentially no changes needed if already wired correctly

**Implementation**:

1. Verify that the weather button/action in the dashboard triggers `showWeatherModal = true` state rather than `navController.navigate("weather")`.
2. The existing `WeatherModal` composable already:
   - Shows as an `AlertDialog` overlay (no navigation)
   - Has location selector, current conditions, "Full Forecast" button
   - Dismisses on tap outside or "Close" button
3. If the dashboard currently navigates to weather, change the weather action handler:
   ```kotlin
   // Before (if navigating):
   onWeatherClick = { navController.navigate("weather") }
   // After (modal):
   var showWeatherModal by remember { mutableStateOf(false) }
   onWeatherClick = { showWeatherModal = true }
   // Then render:
   if (showWeatherModal) {
       WeatherModal(
           savedLocations = settings.savedLocations,
           serverUrl = serverUrl,
           authToken = authToken,
           onDismiss = { showWeatherModal = false },
           onFullForecast = { navController.navigate("weather") }
       )
   }
   ```
4. Preserve the full-screen weather page accessible from sidebar navigation.

**Data Flow**: Dashboard weather action → show modal state → WeatherModal renders as overlay → "Full Forecast" navigates to full screen.

---

### Component 13: Platform Limitations & Dependency Constraints Documentation (Requirements 22, 23)

**Approach**: Document-only changes. No code modifications.

**Files Created**:
- `android/PLATFORM_LIMITATIONS.md`

**Content**:

1. **Platform Limitations** (cannot implement):
   - Hover tooltips on calendar events (checklist items 1.3, 2.5, 3.5, 4.5) — Android touch devices have no hover state. Long-press shows context menu instead.
2. **Dependency Constraints** (blocked by project rules):
   - Marker clustering on Maps screen (checklist item 44.1) — requires `osmdroid-bonuspack` which is not in `build.gradle.kts`. Project rules prohibit installing new dependencies.

---

## Shared Utilities & Patterns

### Custom Shape Definitions (new utility)

Create `ui/theme/CwocShapes.kt` to house reusable clip-path shapes:
- `PointInTimeShape` — hexagonal diamond for zero-duration events
- `BirthdayChipShape` — concave-notch for birthday all-day chips

### Image Loading Helper

Standardize contact image loading with a shared composable:
```kotlin
@Composable
fun ContactAvatar(
    imageUrl: String?,
    name: String,
    size: Dp = 24.dp,
    serverUrl: String,
    authToken: String
)
```
Used by: PeopleChipsRow, PeopleZone, EmailCard, ContactList.

### Drag-to-Reorder API Call

Shared ViewModel utility for persisting reorder:
```kotlin
suspend fun persistReorder(chitIds: List<String>) {
    apiService.reorderChits(ReorderRequest(ids = chitIds))
    // Update local Room sort_order fields
}
```
Used by: Notes, Checklists, Projects, Email Bundles.

---

## Dependency Analysis

| Requirement | New Dependencies | Existing Dependencies Used |
|---|---|---|
| 1-2 (Shapes) | None | Compose UI (GenericShape) |
| 3 (Snap grid) | None | Compose Canvas, PathEffect |
| 4 (Horizontal drag) | None | Compose gesture APIs |
| 5, 16 (Profile images) | None | Coil 2.6.0 |
| 6-8 (Rule habits) | None | Retrofit, Gson |
| 9-11 (Masonry reorder) | None | Compose gesture APIs |
| 12 (Email images) | None | Coil 2.6.0, Room |
| 13 (Bundle drag) | None | Compose gesture APIs |
| 14 (Attachment preview) | None | Coil, Android PdfRenderer |
| 15 (Add to Bundle) | None | Compose Material3 |
| 17 (Full-field search) | None | Room LIKE queries |
| 18 (Map preview) | None | osmdroid 6.1.18 |
| 19 (Condition tree) | None | Compose, Gson |
| 20 (Analog clock) | None | Compose Canvas |
| 21 (Weather modal) | None | Existing WeatherModal |
| 22-23 (Docs) | None | N/A |

**All requirements are implementable with existing dependencies. No new packages needed.**

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| StaggeredGrid drag-to-reorder complexity | Overlay-based approach avoids fighting LazyStaggeredGrid internals; fallback to converting to LazyColumn when in manual sort mode |
| Week view horizontal drag conflicts with scroll | Use `detectDragGesturesAfterLongPress` to require long-press before drag activates, preventing accidental drags during scroll |
| osmdroid MapView lifecycle in Compose | Use `DisposableEffect` for proper lifecycle management (onResume/onPause), matching existing MapScreen pattern |
| Condition tree deep nesting performance | Limit visual nesting to 5 levels (matching web's practical limit); use `key` parameters for efficient recomposition |
| PdfRenderer API level | Available since API 21; our minSdk is 26, so no issue |

---

## Testing Strategy

Manual verification against web app for each requirement:
1. Visual comparison of shapes, colors, and layouts
2. Gesture interaction testing (drag, long-press, tap)
3. API response validation (rule habits, reorder persistence)
4. Edge cases: empty states, missing images, no coordinates, deep condition trees
