# Implementation Plan: Phase 5b — Feature Parity

## Overview

This plan brings the CWOC Android app to full feature parity with the web app by implementing 10 features across 6 waves. Each wave groups tasks that can be worked on independently. All features build on existing entities, repositories, and UI patterns from Phases 4 and 5a.

## Tasks

- [x] 1. Contact Editor Screen — Wire route and build UI
  - [x] 1.1 Add ContactEditor route to Screen.kt and CwocNavGraph.kt
    - Add `data object ContactEditor : Screen("contact-editor/{contactId}")` with `createRoute(contactId)` and `NEW_CONTACT_ID` constant to `Screen.kt`
    - Add composable route in `CwocNavGraph.kt` that extracts `contactId` argument and renders `ContactEditorScreen`
    - Wire `ContactListScreen`'s `onNavigateToContact` callback to navigate to `Screen.ContactEditor.createRoute(contactId)`
    - Add a "New Contact" FAB or button on `ContactListScreen` that navigates to `Screen.ContactEditor.createRoute("new")`
    - _Requirements: 1.1, 1.6_

  - [x] 1.2 Create ContactEditorScreen composable
    - Create `ui/screens/contacts/ContactEditorScreen.kt`
    - Use existing `ContactEditorViewModel` (already handles save/delete/dirty/sync)
    - TopAppBar with back arrow and save (check) icon
    - Zone-based layout using `EditorZoneHeader`:
      - **Name section** (always visible): given name, family name, middle, prefix, suffix fields
      - **Contact Info zone** (collapsible): phones, emails, addresses — each as a multi-value list with add/remove buttons (parse JSON arrays from form state strings)
      - **Details zone** (collapsible): organization, nickname, social context
      - **Tags zone**: color-coded chips with picker (reuse pattern from chit editor)
      - **Color zone**: reuse `ColorZone` pattern
      - **Notes zone**: multiline text field
      - **Dates zone**: labeled date entries (birthday, anniversary, etc.)
      - **Favorite toggle**: switch in the toolbar or top section
    - Delete button at bottom with confirmation dialog (calls `viewModel.delete()`)
    - BackHandler with unsaved changes check (compare form state to loaded state)
    - LaunchedEffect on `isSaved` to navigate back
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Calendar Additional Views — Month, Year, Itinerary, X-Day
  - [x] 2.1 Extend CalendarViewMode enum and ViewModel logic
    - Add `MONTH`, `YEAR`, `ITINERARY`, `X_DAY` to `CalendarViewMode` enum in `CalendarViewModel.kt`
    - Update `getDateRange()` to compute correct ranges for each mode:
      - MONTH: first day of month to last day of month
      - YEAR: Jan 1 to Dec 31 of selected year
      - ITINERARY: today to today + 30 days
      - X_DAY: selectedDate to selectedDate + xDayCount (default 7, read from settings `customDaysCount`)
    - Update `headerTitle` computed property for each mode
    - Update `previousPeriod()`/`nextPeriod()` navigation for each mode
    - Persist last-used view mode in SharedPreferences
    - _Requirements: 2.1, 2.6_

  - [x] 2.2 Create Month view composable
    - Add `MonthView` composable to `CalendarScreen.kt` (or extract to `CalendarMonthView.kt`)
    - Display a 7-column grid (Sun–Sat or Mon–Sun based on `weekStartDay` setting)
    - Each cell shows day number + event indicator dots (max 3 dots, colored by event color)
    - Tapping a day switches to Day view for that date
    - Current day highlighted
    - _Requirements: 2.2_

  - [x] 2.3 Create Year view composable
    - Add `YearView` composable — 12 mini-month grids in a 3×4 or 4×3 layout
    - Each mini-month shows day numbers with dot indicators for days with events
    - Tapping a month switches to Month view for that month
    - _Requirements: 2.3_

  - [x] 2.4 Create Itinerary view composable
    - Add `ItineraryView` composable — chronological list grouped by day
    - Day headers with date, event cards below each header
    - Days with no events are skipped (only show days that have events)
    - Tapping an event navigates to editor
    - _Requirements: 2.4_

  - [x] 2.5 Create X-Day view composable
    - Add `XDayView` composable — horizontal scrollable columns, one per day
    - Default 7 days, configurable via settings `customDaysCount`
    - Each column shows day header + stacked event cards
    - Tapping an event navigates to editor
    - _Requirements: 2.5_

  - [x] 2.6 Update ViewModeToggle to show all 6 modes
    - Replace the 2-chip Row with a `ScrollableTabRow` or horizontal `LazyRow` of `FilterChip`s for all 6 modes: Day, Week, Month, Year, Itinerary, X-Day
    - _Requirements: 2.1_

- [x] 3. Checkpoint — Contact Editor and Calendar views compile and run
  - Ensure all code compiles, ask the user if questions arise.

- [x] 4. Omni View — Configurable dashboard screen
  - [x] 4.1 Create OmniViewViewModel
    - Create `ui/screens/omni/OmniViewViewModel.kt` as `@HiltViewModel`
    - Inject `ChitRepository` and `SettingsRepository`
    - Parse Omni View section config from settings (or use defaults if not configured)
    - Query chits for each section:
      - Chrono Anchored: today's timed events (has startDatetime today, not all-day)
      - Reminders: chits with alerts in the next 24h
      - On Deck: next 5 tasks by due date (status != Complete)
      - Soon: tasks due within 7 days
      - Pinned Notes: pinned=true, has note content, no checklist
      - Pinned Checklists: pinned=true, has checklist content
    - Expose each section as `StateFlow<List<ChitEntity>>`
    - Expose section visibility/order as `StateFlow<List<OmniSection>>`
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 4.2 Create OmniViewScreen composable
    - Create `ui/screens/omni/OmniViewScreen.kt`
    - Render sections in configured order, skip hidden sections
    - Each section: header text + LazyColumn of chit cards (reuse existing card pattern)
    - Tapping any item navigates to editor
    - Empty sections show a subtle "Nothing here" message
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 4.3 Wire Omni View route and navigation
    - Add `data object OmniView : Screen("omni")` to `Screen.kt`
    - Add composable route in `CwocNavGraph.kt`
    - Add "Omni View" item to `SidebarContent.kt` navigation
    - _Requirements: 3.1_

- [x] 5. Tags UI — Proper tag picker with tree, colors, favorites
  - [x] 5.1 Create TagNode parser utility
    - Create `domain/tags/TagTreeParser.kt`
    - Parse `SettingsEntity.tags` JSON string into `List<TagNode>` tree structure
    - Each node: name, fullPath (slash-separated), color, favorite, children
    - Flatten tree for search functionality
    - _Requirements: 4.2, 4.5_

  - [x] 5.2 Create TagsPickerSheet composable
    - Create `ui/screens/editor/zones/TagsPickerSheet.kt` using `ModalBottomSheet`
    - Top section: search/filter text field
    - Favorites section: horizontal row of favorite tags as colored chips
    - Tree section: expandable/collapsible tag tree with indent levels
    - Each tag row: colored dot + name + checkbox (selected state)
    - Bottom: "Create new tag" text field with confirm button
    - _Requirements: 4.2, 4.3, 4.5, 4.6_

  - [x] 5.3 Update TagsZone in ChitEditorScreen to use picker
    - Replace the current `ChipInputField`-based `TagsZone` with:
      - Display: color-coded `InputChip`s with X to remove
      - "Add Tag" button that opens `TagsPickerSheet`
    - Load tag tree from `SettingsRepository` via ViewModel
    - On tag created inline: add to local settings tags list, mark settings dirty
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Markdown Preview in Editor Notes
  - [x] 6.1 Create MarkdownRenderer composable
    - Create `ui/components/MarkdownRenderer.kt`
    - Parse markdown text and render using Compose:
      - Headings (H1-H6): different `TextStyle` sizes/weights
      - Bold/Italic: `SpanStyle` with `FontWeight.Bold` / `FontStyle.Italic`
      - Links: clickable `AnnotatedString` with underline, opens in browser
      - Unordered lists: bullet character + indented text
      - Ordered lists: number + indented text
      - Code blocks: monospace font with light background `Surface`
      - Inline code: monospace `SpanStyle` with background
      - Blockquotes: left border + italic text
      - Images: `AsyncImage` (Coil) constrained to `fillMaxWidth()`
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 6.2 Add preview toggle to NotesZone
    - Modify `NotesZone` in `ChitEditorScreen.kt`
    - Add an "Edit / Preview" toggle button in the zone header trailing content
    - When Preview: show `MarkdownRenderer(note)` instead of `OutlinedTextField`
    - When Edit: show the existing `OutlinedTextField`
    - Default to Edit mode
    - _Requirements: 5.1_

- [x] 7. Checkpoint — Omni View, Tags, and Markdown preview working
  - Ensure all code compiles, ask the user if questions arise.

- [x] 8. Pin/Archive/Snooze Actions
  - [x] 8.1 Add convenience methods to ChitRepository
    - Add to `ChitRepository`: `suspend fun pin(chitId: String)`, `unpin(chitId: String)`, `archive(chitId: String)`, `unarchive(chitId: String)`, `snooze(chitId: String, until: String)`, `unsnooze(chitId: String)`
    - Each method: updates the field, marks dirty with the changed field name, triggers sync push if online
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 Create SnoozePickerDialog composable
    - Create `ui/components/SnoozePickerDialog.kt`
    - Preset buttons: "15 min", "1 hour", "3 hours", "Tomorrow 9am", "Next Monday 9am"
    - "Custom" button opens Material 3 DateTimePicker
    - Returns selected `Instant` (or ISO string) to caller
    - _Requirements: 6.3_

  - [x] 8.3 Create ChitActionMenu composable (long-press context menu)
    - Create `ui/components/ChitActionMenu.kt`
    - `DropdownMenu` with items: Pin/Unpin, Archive/Unarchive, Snooze, Edit, Delete
    - Labels change based on current chit state (e.g., "Unpin" if already pinned)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.4 Wire actions into list screens and editor
    - Add long-press detection to chit cards in TasksScreen, NotesScreen, ChecklistsScreen, AlertsScreen, ProjectsScreen
    - On long-press: show `ChitActionMenu`
    - In `ChitEditorScreen`: add pin/archive/snooze icon buttons to TopAppBar actions
    - Ensure pinned chits sort to top in list views (modify existing sort logic or add a pre-sort step)
    - Ensure archived chits are hidden unless `showArchived` filter is on
    - Ensure snoozed chits are hidden unless `showSnoozed` filter is on (compare `snoozedUntil` to now)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 9. Habits View and Editor Zone
  - [x] 9.1 Create HabitsZone composable
    - Create `ui/screens/editor/zones/HabitsZone.kt`
    - Uses `EditorZoneHeader` for collapse/expand
    - Content when expanded:
      - Habit toggle switch (enables/disables the zone fields)
      - Goal input (number field)
      - Success count with +/- buttons
      - Reset period dropdown: Daily, Weekly, Monthly
      - "Hide overall stats" checkbox
      - Display: current streak, success rate percentage, progress bar (success/goal)
    - All fields map to existing `ChitEntity` habit fields via `ChitFormState`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.2 Add HabitsZone to ChitEditorScreen
    - Insert `HabitsZone` between Recurrence and Tags zones in `ChitEditorScreen.kt`
    - Wire form state fields: `habit`, `habitGoal`, `habitSuccess`, `habitResetPeriod`, `habitLastActionDate`, `habitHideOverall`
    - Add these fields to `ChitFormState` if not already present
    - _Requirements: 7.2_

  - [x] 9.3 Add habit indicators to task cards
    - Modify task card composable in `TasksScreen.kt` to show habit indicators when `chit.habit == true`:
      - Streak badge (consecutive periods meeting goal)
      - Small progress bar (success/goal for current period)
      - Success rate text (e.g., "75%")
    - Calculate streak from `habitLastActionDate` and `habitResetPeriod`
    - _Requirements: 7.1, 7.4_

- [x] 10. Checkpoint — Pin/Archive/Snooze and Habits working
  - Ensure all code compiles, ask the user if questions arise.

- [x] 11. Weather Screen
  - [x] 11.1 Create WeatherViewModel
    - Create `ui/screens/weather/WeatherViewModel.kt` as `@HiltViewModel`
    - Inject `CwocApiService`
    - Fetch from `/api/weather/forecasts` endpoint
    - Parse response into `List<LocationForecast>` (location name, daily forecasts with temp high/low, conditions, precip chance, wind)
    - Expose as `StateFlow` with loading/error states
    - Pull-to-refresh support
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 11.2 Create WeatherScreen composable
    - Create `ui/screens/weather/WeatherScreen.kt`
    - TopAppBar with "Weather" title and back navigation
    - For each location: card with location name header, current conditions, and daily forecast rows
    - Each forecast row: date, high/low temps, conditions icon/text, precip %, wind speed
    - Loading spinner and error state with retry button
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 11.3 Wire WeatherScreen route (replace placeholder)
    - Update `CwocNavGraph.kt` to replace the placeholder Weather route with the real `WeatherScreen` composable
    - _Requirements: 8.1_

- [x] 12. Help Screen
  - [x] 12.1 Create HelpViewModel
    - Create `ui/screens/help/HelpViewModel.kt` as `@HiltViewModel`
    - Inject `CwocApiService`
    - Fetch topic list from `/api/docs` endpoint
    - Parse into `List<HelpTopic>` (slug, title, content markdown)
    - Support topic selection and back navigation within help
    - _Requirements: 9.2, 9.4_

  - [x] 12.2 Create HelpScreen composable
    - Create `ui/screens/help/HelpScreen.kt`
    - Two states: topic list view and topic detail view
    - Topic list: scrollable list of topic titles as clickable cards
    - Topic detail: TopAppBar with back arrow + topic title, body rendered with `MarkdownRenderer`
    - Loading and error states
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 12.3 Wire HelpScreen route (replace placeholder)
    - Update `CwocNavGraph.kt` to replace the placeholder Help route with the real `HelpScreen` composable
    - _Requirements: 9.1_

- [x] 13. Notifications Display
  - [x] 13.1 Create NotificationEntity and DAO
    - Create `data/local/entity/NotificationEntity.kt` with fields: id, type, title, body, chitId, senderId, isRead, isDismissed, createdDatetime, actionTaken
    - Create `data/local/dao/NotificationDao.kt` with queries: getAll (not dismissed, ordered by date), getUnreadCount, markRead, updateAction, insert, deleteAll
    - _Requirements: 10.1, 10.2_

  - [x] 13.2 Create Room migration v5→v6
    - Create `data/local/migration/Migration_5_6.kt`
    - SQL: `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, chitId TEXT, senderId TEXT, isRead INTEGER NOT NULL DEFAULT 0, isDismissed INTEGER NOT NULL DEFAULT 0, createdDatetime TEXT NOT NULL, actionTaken TEXT)`
    - Register in `AppModule.provideCwocDatabase()` via `.addMigrations(MIGRATION_5_6)`
    - Update `@Database(version = 6)` in `CwocDatabase.kt`
    - Add `NotificationEntity::class` to entities array
    - Add `abstract fun notificationDao(): NotificationDao` to database class
    - _Requirements: 10.1_

  - [x] 13.3 Create NotificationsViewModel
    - Create `ui/screens/notifications/NotificationsViewModel.kt` as `@HiltViewModel`
    - Inject `NotificationDao`, `ChitRepository`, `SyncPushEngine`
    - Expose `notifications: StateFlow<List<NotificationEntity>>` (non-dismissed, ordered by date desc)
    - Expose `unreadCount: StateFlow<Int>` for badge
    - `fun markRead(id)`, `fun accept(id)`, `fun decline(id)`, `fun dismiss(id)`
    - Accept/decline update `actionTaken` field and trigger sync push
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 13.4 Create NotificationsScreen composable
    - Create `ui/screens/notifications/NotificationsScreen.kt`
    - TopAppBar with "Notifications" title and back navigation
    - List of notification cards: icon by type, title, body preview, timestamp
    - Invitation notifications: Accept/Decline buttons
    - Reminder notifications: Dismiss button
    - Swipe-to-dismiss for all types
    - Empty state when no notifications
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 13.5 Add notification badge to TopAppBar and wire route
    - Add `data object Notifications : Screen("notifications")` to `Screen.kt`
    - Add composable route in `CwocNavGraph.kt`
    - In `MainActivity.kt` TopAppBar: add a bell icon button with badge overlay showing unread count
    - Tapping badge navigates to `Screen.Notifications`
    - Badge hidden when unread count is 0
    - Inject `NotificationsViewModel` (or a lightweight badge-only ViewModel) at activity scope for the badge count
    - _Requirements: 10.1, 10.2_

- [x] 14. Final checkpoint — All features compile and integrate
  - Ensure all code compiles, ask the user if questions arise.

## Notes

- No tests included per project rules (tests are optional)
- Existing `ContactEditorViewModel` handles all save/delete/sync logic — the UI just needs to be built
- Room database bumps from version 5 to 6 (notifications table) — requires `clean build → uninstall + reinstall` on device
- All new files go under `android/app/src/main/java/com/cwoc/app/`
- The `MarkdownRenderer` composable is shared between Notes preview and Help screen
- Weather and Help screens replace existing placeholder routes (no new Screen entries needed for those)
- Pin/Archive/Snooze use existing `ChitEntity` fields — no schema changes needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "5.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "2.4", "2.5", "2.6", "5.2", "6.1", "8.2", "8.3"] },
    { "id": 2, "tasks": ["4.1", "5.3", "6.2", "8.4", "9.1", "13.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "9.2", "9.3", "11.1", "12.1", "13.2"] },
    { "id": 4, "tasks": ["11.2", "11.3", "12.2", "12.3", "13.3"] },
    { "id": 5, "tasks": ["13.4", "13.5"] }
  ]
}
```
