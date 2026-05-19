# Implementation Plan: Android Parity Remaining Gaps

## Overview

Implement all 23 remaining parity gaps between the CWOC Android app and the web mobile browser version. This covers calendar event shapes, snap grid overlays, horizontal drag, profile images on people chips, rule habits, drag-to-reorder across multiple views, email enhancements, full-field search, contact editor map preview, rule editor condition tree, analog clock face, weather overlay modal, and platform limitation documentation.

## Tasks

- [x] 1. Point-in-Time Event Shape Rendering (Calendar Day/Week/WorkHours/XDay)
  - [x] 1.1 Create `ui/theme/CwocShapes.kt` with `PointInTimeShape` GenericShape
    - Define hexagonal clip-path matching web CSS `.timed-event.point-in-time` polygon coordinates
    - Shape: `moveTo(notch, 0f)` → `lineTo(width - notch, 0f)` → `lineTo(width, height/2)` → `lineTo(width - notch, height)` → `lineTo(notch, height)` → `lineTo(0f, height/2)` → close
    - Use `8.dp.toPx()` for the notch depth
    - _Requirements: 1.1_
  - [x] 1.2 Add `BirthdayChipShape` GenericShape to `CwocShapes.kt`
    - Define concave-notch clip-path matching web CSS `.birthday-chip` polygon coordinates
    - Shape: `moveTo(0f, 0f)` → `lineTo(notch, height/2)` → `lineTo(0f, height)` → `lineTo(width, height)` → `lineTo(width - notch, height/2)` → `lineTo(width, 0f)` → close
    - _Requirements: 2.1_
  - [x] 1.3 Apply `PointInTimeShape` to `DayEventCard` in `CalendarTimeGrid.kt`
    - When `info.isPointInTime` is true (start == end time), replace `RoundedCornerShape(4.dp)` clip with `PointInTimeShape`
    - Add extra horizontal padding (12.dp) to match web's `padding-left: 12px; padding-right: 12px`
    - Preserve event title text, color, and tap interaction
    - _Requirements: 1.2, 1.6_
  - [x] 1.4 Apply `PointInTimeShape` to `WeekEventChip` in `CalendarTimeGrid.kt`
    - Pass `CalendarDateInfo` to `WeekEventChip` (add parameter if not already present)
    - When event is point-in-time, use `PointInTimeShape` clip instead of default rounded shape
    - _Requirements: 1.3, 1.4, 1.5_
  - [x] 1.5 Apply `BirthdayChipShape` to `AllDayEventChip` in `CalendarTimeGrid.kt`
    - Detect birthday events by checking if `event.tags` JSON contains "Birthday" tag
    - When birthday detected, use `BirthdayChipShape` clip and prepend 🎂 icon to title
    - Apply in Week, Work Hours, and X-Day/SevenDay views (all use same composable)
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 2. Snap Grid Visual Overlay During Calendar Drag Operations
  - [x] 2.1 Add `isAnyEventDragging` state to `DayTimeGrid` composable
    - Hoist `var isAnyEventDragging by remember { mutableStateOf(false) }` at grid level
    - Pass `onDragStateChange: (Boolean) -> Unit` callback to `DayEventCard`
    - Set true on `onDragStart`, false on `onDragEnd`/`onDragCancel`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.2 Add `isAnyEventDragging` state to `WeekTimeGrid` composable
    - Same pattern as DayTimeGrid — hoist state, pass callback to `WeekEventChip`
    - Covers Week, Work Hours, and X-Day/SevenDay views
    - _Requirements: 3.5, 3.6, 3.7_
  - [x] 2.3 Render snap grid lines in Canvas when drag is active
    - In both `DayTimeGrid` and `WeekTimeGrid` Canvas composables, when `isAnyEventDragging` is true:
    - Calculate `snapPx = (snapMinutes / 60f) * effectiveHourHeight.toPx()`
    - Draw dashed horizontal lines at every `snapPx` interval using `PathEffect.dashPathEffect(floatArrayOf(4f, 4f))`
    - Use semi-transparent brown color `Color(0x336B4E31)`
    - Read snap interval from settings (already available in ViewModel)
    - _Requirements: 3.8_

- [x] 3. Week View Horizontal Drag Between Day Columns
  - [x] 3.1 Add 2D drag state to `WeekEventChip`
    - Add `dragOffsetX`, `dragOffsetY`, and `isDragging` state variables
    - Replace tap-only gesture with combined: short tap → `onTap()`, long press + drag → enter drag mode
    - Use `detectDragGesturesAfterLongPress` to prevent conflicts with scroll
    - _Requirements: 4.1_
  - [x] 3.2 Pass column geometry to `WeekEventChip`
    - Add parameters: `columnWidthPx: Float`, `dayIndex: Int`, `days: List<LocalDate>`
    - These are needed to calculate which day column the drag target lands in
    - _Requirements: 4.2_
  - [x] 3.3 Calculate target day and time on drag end
    - `dayDelta = (dragOffsetX / columnWidthPx).roundToInt()`
    - `targetDayIndex = (dayIndex + dayDelta).coerceIn(0, days.size - 1)`
    - `targetDate = days[targetDayIndex]`
    - `minuteDelta = snapToGrid((dragOffsetY / hourHeightPx * 60).toInt(), snapMinutes)`
    - Call `onEventDragEnd` with new start/end times on target date
    - _Requirements: 4.3, 4.7_
  - [x] 3.4 Add visual column highlight during drag
    - Hoist `highlightedColumn: Int?` state to `WeekTimeGrid`
    - During drag, calculate target column index and set highlight state
    - Render semi-transparent overlay on the highlighted column
    - Clear highlight on drag end/cancel
    - _Requirements: 4.2, 4.4, 4.5, 4.6_

- [x] 4. Profile Images on People Chips (Tasks View + Editor People Zone)
  - [x] 4.1 Update `PersonChip` composable to accept optional `imageUrl: String?`
    - In `ui/components/ChitCardEnhancements.kt` (or wherever `PersonChip` lives)
    - When `imageUrl` is non-null, render Coil `AsyncImage` (circular, 14.dp) instead of initials Box
    - Use auth headers: `ImageRequest.Builder.addHeader("Authorization", "Bearer $authToken")`
    - Fall back to initials circle on null, error, or loading failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 4.2 Update `PeopleChipsRow` to accept `contactImages: Map<String, String?>`
    - Pass image URL for each person name to `PersonChip`
    - Build map in ViewModel by matching people names to `ContactEntity.imageUrl`
    - _Requirements: 5.1, 16.1_
  - [x] 4.3 Wire profile images in `TasksScreen` / `TasksViewModel`
    - ViewModel already has access to contacts — build `name → imageUrl` map
    - Pass to `PeopleChipsRow` on task cards
    - _Requirements: 5.1, 5.3_
  - [x] 4.4 Wire profile images in `PeopleZone` (editor)
    - Add `contactImages: Map<String, String?>` parameter to `PeopleZone`
    - Populate from same contacts data source used for `contactColors`
    - Pass through composable chain to `PersonChip`
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 5. Rule Habits from API
  - [x] 5.1 Add Retrofit endpoint for habit rules
    - In `data/remote/CwocApiService.kt`: `@GET("api/rules") suspend fun getHabitRules(@Query("habit") habit: Boolean = true): List<RuleHabitDto>`
    - Define `RuleHabitDto` with fields: `id`, `name`, `description`, `habit_summary` (nested: `current_status`, `streak`, `success_rate`)
    - _Requirements: 6.1_
  - [x] 5.2 Add rule habits state to `TasksViewModel`
    - `val ruleHabits: StateFlow<List<RuleHabitDto>>` — fetched when habits mode activates
    - Fetch via repository/API service call
    - _Requirements: 6.2_
  - [x] 5.3 Render rule habits section in `HabitsView` composable
    - After chit habit sections, add "🤖 Rule Habits" header
    - Render each rule habit with: name, 🤖 badge, status pill (due/met/missed), streak 🔥, success rate 📈
    - Hide section when `ruleHabits` is empty
    - _Requirements: 6.3, 6.4_

- [x] 6. Aggregate Habits Success Rate Bar
  - [x] 6.1 Calculate combined success rate in ViewModel
    - Combine chit habit rates (from `calculateHistoricalSuccessRate`) with rule habit `success_rate` values
    - Weight equally or by count (match web behavior)
    - _Requirements: 7.1, 7.3, 7.4_
  - [x] 6.2 Render aggregate bar in `HabitsView`
    - Display as `LinearProgressIndicator` with label "📊 Combined Success Rate: X%"
    - Insert at top of habits list
    - _Requirements: 7.2_

- [x] 7. Habits Success Window Setting
  - [x] 7.1 Read `habits_success_window` from user settings in ViewModel
    - Add to settings state flow or sidebar state
    - _Requirements: 8.1_
  - [x] 7.2 Apply success window to habit rate calculations
    - Filter `recurrence_exceptions` entries by date within the window period
    - Pass window value to `calculateHistoricalSuccessRate`
    - _Requirements: 8.2, 8.3_

- [x] 8. Masonry Drag-to-Reorder for Checklists
  - [x] 8.1 Create `ui/components/ReorderableStaggeredGrid.kt`
    - Composable that wraps `LazyVerticalStaggeredGrid` with long-press drag-to-reorder
    - On long-press: capture item position, render draggable overlay copy
    - Track finger position to determine target drop index
    - On drop: call `onReorder(fromIndex, toIndex)` callback
    - Visual feedback: elevate dragged item, dim original position, show insertion indicator
    - _Requirements: 9.1, 9.2, 9.4_
  - [x] 8.2 Integrate `ReorderableStaggeredGrid` in Checklists view
    - Replace current `LazyVerticalStaggeredGrid` with `ReorderableStaggeredGrid`
    - Only enable when sort mode is "manual" (matching web behavior)
    - _Requirements: 9.1, 9.2_
  - [x] 8.3 Persist reorder via API
    - On reorder callback, call `PUT /api/chits/reorder` with `{ids: [ordered_id_list]}`
    - Update local Room `sort_order` field
    - _Requirements: 9.3_

- [x] 9. Masonry Drag-to-Reorder for Notes
  - [x] 9.1 Integrate `ReorderableStaggeredGrid` in Notes view
    - Replace current `LazyVerticalStaggeredGrid` with `ReorderableStaggeredGrid`
    - Only enable when sort mode is "manual"
    - _Requirements: 10.1, 10.2, 10.4_
  - [x] 9.2 Persist reorder via API (same pattern as Checklists)
    - Call `PUT /api/chits/reorder` with ordered ID list on drop
    - Update local Room `sort_order` field
    - _Requirements: 10.3_

- [x] 10. Projects Drag-to-Reorder
  - [x] 10.1 Add drag-to-reorder to Projects list
    - Projects already uses a list layout — wrap with long-press drag gesture
    - Use Compose `detectDragGesturesAfterLongPress` on each project card
    - Visual feedback: elevation + opacity change during drag
    - _Requirements: 11.1, 11.2, 11.4_
  - [x] 10.2 Persist project reorder via API
    - Call `PUT /api/chits/reorder` with ordered project ID list on drop
    - Update local Room `sort_order` field
    - _Requirements: 11.3_

- [x] 11. Email Contact Image Lookup
  - [x] 11.1 Add DAO method to find contact by email
    - In `ContactDao.kt`: `@Query("SELECT * FROM contacts WHERE emails LIKE '%' || :email || '%' AND deleted = 0 LIMIT 1") suspend fun findByEmail(email: String): ContactEntity?`
    - _Requirements: 12.2_
  - [x] 11.2 Add repository method with in-memory cache
    - In `ContactRepository.kt`: `private val emailImageCache = ConcurrentHashMap<String, String?>()` + `suspend fun getImageUrlForEmail(email: String): String?`
    - _Requirements: 12.3_
  - [x] 11.3 Display contact image on email cards
    - In email card composable, resolve sender email → image URL → Coil `AsyncImage` (circular, 24dp)
    - Fall back to initials avatar when no match found
    - _Requirements: 12.1, 12.4_

- [x] 12. Email Bundle Tab Drag-to-Reorder
  - [x] 12.1 Add long-press drag gesture to bundle tabs
    - In `BundleToolbar.kt` or equivalent, wrap `ScrollableTabRow` items with long-press drag detection
    - Track horizontal drag offset
    - _Requirements: 13.1, 13.2_
  - [x] 12.2 Calculate target tab index and persist
    - On drop, calculate target index from position
    - Call `onBundleReorder(fromIndex, toIndex)` → ViewModel persists via API
    - Visual: dragged tab gets elevation + scale, others shift
    - _Requirements: 13.3, 13.4_

- [x] 13. Email Attachment Tap-to-Preview
  - [x] 13.1 Create `ui/screens/email/AttachmentPreviewDialog.kt`
    - Composable dialog accepting `EmailAttachment`, `serverUrl`, `authToken`, `onDismiss`, `onOpenExternal`
    - Header: filename, size (formatted), MIME type badge
    - _Requirements: 14.1, 14.4_
  - [x] 13.2 Implement MIME-type-based preview content
    - `image/*` → Coil `AsyncImage` with zoom/pan
    - `text/plain` → `Text` with scroll, monospace font
    - `application/pdf` → Android `PdfRenderer` in Canvas (page-by-page)
    - Other → "Cannot preview. Open with external app?" button → `Intent.ACTION_VIEW`
    - _Requirements: 14.2, 14.3_
  - [x] 13.3 Wire attachment tap to preview dialog
    - In existing attachment list item, on tap → show `AttachmentPreviewDialog`
    - _Requirements: 14.1_

- [x] 14. Email "Add to Bundle" Context Menu Action
  - [x] 14.1 Add "Add to Bundle" to `EmailContextMenu.kt`
    - `DropdownMenuItem` with folder icon and "Add to Bundle" text
    - On click: dismiss menu, trigger `onAddToBundle` callback
    - _Requirements: 15.1_
  - [x] 14.2 Create `BundlePickerDialog` composable
    - Lists all available bundles
    - Highlights current bundle if email is already in one
    - On selection: calls ViewModel method to update email's bundle assignment via API
    - _Requirements: 15.2, 15.3, 15.4_

- [x] 15. Full-Field Search in People Zone
  - [x] 15.1 Verify/fix `ContactDao.searchAll()` query
    - Ensure query searches across ALL fields: givenName, surname, displayName, nickname, organization, socialContext, emails, phones, addresses, callSigns, xHandles, websites, notes, tags
    - Match web's `_contactMatchesFilter` behavior
    - _Requirements: 17.1, 17.2_
  - [x] 15.2 Update PeopleZone search to use full-field DAO query
    - Change from filtering `contactNames` (name-only) to using `ContactRepository.searchContacts(query)` flow
    - Display matching contacts regardless of which field matched
    - Show contact name in suggestion list (optionally with matched field indicator)
    - _Requirements: 17.3, 17.4_

- [x] 16. Contact Editor Address Map Preview
  - [x] 16.1 Create `ContactMapPreview` composable
    - In `ui/screens/contacts/ContactEditorScreen.kt`
    - Use osmdroid `MapView` wrapped in `AndroidView`
    - Set tile source to MAPNIK, zoom to 15, center on coordinates
    - Place marker at geocoded coordinates
    - Disable touch interactions (static preview)
    - _Requirements: 18.1, 18.2, 18.3_
  - [x] 16.2 Integrate map preview in contact editor
    - Parse contact's address JSON for `lat` and `lon` fields
    - When coordinates exist, render `ContactMapPreview` below address field (150.dp height, rounded corners)
    - On tap: open full maps app (existing "Open in Maps" intent)
    - When no coordinates: hide map preview entirely
    - Use `DisposableEffect` for proper MapView lifecycle management
    - _Requirements: 18.4, 18.5_

- [x] 17. Rule Editor Condition Tree Builder
  - [x] 17.1 Define `ConditionNode` sealed class data model
    - `ConditionNode.Group`: id, operator (AND/OR), children list
    - `ConditionNode.Leaf`: id, field, operator (equals/contains/greater_than/etc.), value
    - Matching web's JSON structure for conditions
    - _Requirements: 19.1, 19.7_
  - [x] 17.2 Create `ui/screens/rules/ConditionTreeBuilder.kt`
    - Recursive composable: `ConditionTreeBuilder(root, onTreeChange, availableFields)`
    - `ConditionGroupView`: AND/OR toggle, remove button (except root), renders children recursively, "+ Condition" and "+ Group" buttons
    - `ConditionLeafView`: field dropdown, operator dropdown, value text field, remove button (×)
    - Visual nesting: left border + indent per nesting level
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_
  - [x] 17.3 Add serialization/deserialization for condition tree
    - `serializeTree()`: strips internal IDs, produces same JSON as web API
    - `deserializeTree()`: adds internal IDs when loading from API
    - _Requirements: 19.7_
  - [x] 17.4 Integrate condition tree in `RuleEditorScreen`
    - Add `conditionTree: MutableStateFlow<ConditionNode.Group>` to ViewModel
    - Replace flat "Action Config (JSON)" text field with `ConditionTreeBuilder` for conditions section
    - Wire save to serialize tree to API JSON format
    - _Requirements: 19.7_

- [x] 18. Clock Modal Analog Face Rendering
  - [x] 18.1 Create `AnalogClockFace` composable using Compose Canvas
    - In `ui/components/ClockModal.kt`
    - Draw face circle: parchment fill (#FDF5E6), brown border (#6B4E31)
    - Draw 12 hour markers (thick lines) and 60 minute markers (thin lines, skip hours)
    - Draw hour hand (thick, short), minute hand (medium), second hand (thin, red #C62828)
    - Draw center dot (dark brown #4A2C2A)
    - Size: 160.dp
    - _Requirements: 20.1, 20.2, 20.4_
  - [x] 18.2 Animate second hand in real-time
    - Reuse existing `LaunchedEffect` that updates `now` every second
    - Canvas redraws hands at new angles on each tick
    - _Requirements: 20.3_
  - [x] 18.3 Place analog clock in ClockModal layout
    - Display above the timezone list
    - Show local timezone's analog face
    - _Requirements: 20.5_

- [x] 19. Weather as Overlay Modal on Dashboard
  - [x] 19.1 Verify/fix weather trigger from dashboard
    - Ensure weather button/action triggers `showWeatherModal = true` state, NOT `navController.navigate("weather")`
    - If currently navigating, change to modal state approach
    - _Requirements: 21.1_
  - [x] 19.2 Render `WeatherModal` as overlay from dashboard
    - When `showWeatherModal` is true, render existing `WeatherModal` composable as `AlertDialog` overlay
    - Include current conditions, forecast, location info
    - Dismiss on tap outside, back gesture, or close button
    - "Full Forecast" button navigates to full-screen weather page
    - _Requirements: 21.2, 21.3_
  - [x] 19.3 Preserve full-screen weather page
    - Keep existing weather screen accessible from sidebar navigation
    - Modal is dashboard-only shortcut
    - _Requirements: 21.4_

- [x] 20. Platform Limitations & Dependency Constraints Documentation
  - [x] 20.1 Create `android/PLATFORM_LIMITATIONS.md`
    - Document: Hover tooltips on calendar events (items 1.3, 2.5, 3.5, 4.5) — Android touch devices have no hover state
    - Document: Marker clustering on Maps (item 44.1) — requires osmdroid-bonuspack not in build.gradle.kts
    - _Requirements: 22.1, 22.2, 23.1, 23.2_

- [x] 21. Shared Utility: ContactAvatar Composable
  - [x] 21.1 Create standardized `ContactAvatar` composable
    - Parameters: `imageUrl: String?`, `name: String`, `size: Dp = 24.dp`, `serverUrl: String`, `authToken: String`
    - When imageUrl non-null: Coil `AsyncImage` with auth headers, circular clip, crossfade
    - When null/error: initials circle with contact color background
    - Used by: PeopleChipsRow, PeopleZone, EmailCard, ContactList
    - _Requirements: 5.3, 5.4, 12.4, 16.4_

- [x] 22. Shared Utility: Reorder API Call
  - [x] 22.1 Create shared ViewModel utility for persisting reorder
    - `suspend fun persistReorder(chitIds: List<String>)` — calls `PUT /api/chits/reorder` with `ReorderRequest(ids = chitIds)`
    - Updates local Room `sort_order` fields after successful API call
    - Used by: Notes, Checklists, Projects, Email Bundles
    - _Requirements: 9.3, 10.3, 11.3, 13.4_

- [x] 23. Checkpoint — Final Verification
  - [x] 23.1 Verify all 21 functional requirements are addressed by comparing Android behavior to web mobile browser
  - [x] 23.2 Verify no new dependencies were added to `build.gradle.kts`
  - [x] 23.3 Update `android/PLATFORM_LIMITATIONS.md` if any additional platform limitations were discovered during implementation
  - [x] 23.4 Verify all composables compile and render correctly (manual build + test on device)


## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 20, 21, 22],
      "description": "Foundation: shapes, shared utilities, documentation"
    },
    {
      "wave": 2,
      "tasks": [2, 4, 5, 8, 11],
      "description": "Core features using shared utilities: snap grid, profile images, rule habits, masonry reorder, email images"
    },
    {
      "wave": 3,
      "tasks": [3, 6, 7, 9, 10, 12, 15, 16, 17, 18, 19],
      "description": "Features depending on wave 2: horizontal drag, aggregate bar, success window, notes/projects reorder, bundle drag, search, map, condition tree, clock, weather"
    },
    {
      "wave": 4,
      "tasks": [13, 14],
      "description": "Email features depending on wave 3: attachment preview, add to bundle"
    },
    {
      "wave": 5,
      "tasks": [23],
      "description": "Final verification checkpoint"
    }
  ]
}
```

## Notes

- All requirements are implementable with existing dependencies (Coil 2.6.0, osmdroid 6.1.18, Compose Canvas, Compose gesture APIs). No new packages needed.
- Tasks 21 and 22 (shared utilities) should be implemented FIRST as they are dependencies for multiple other tasks.
- Task 8 creates the `ReorderableStaggeredGrid` component that is reused by Tasks 9 and 10.
- Task 20 (documentation) can be done at any time — no code dependencies.
- The snap grid overlay (Task 2) and horizontal drag (Task 3) build on the existing drag infrastructure in `CalendarTimeGrid.kt`.
- Profile images (Task 4) require the `ContactAvatar` utility (Task 21) to be created first for consistency across all usage sites.
- Email tasks (11-14) share context and should be done sequentially after the shared utilities are in place.
