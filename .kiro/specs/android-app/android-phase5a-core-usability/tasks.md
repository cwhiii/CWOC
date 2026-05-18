# Implementation Plan: Phase 5a — Core Usability

## Overview

This plan transforms the CWOC Android app from a basic viewer into a daily-driver by implementing sidebar navigation, settings, proper editor UIs, search, filters, sort, trash, unsaved changes detection, and undo-on-delete. The existing BottomNavBar is replaced with a ModalNavigationDrawer + C CAPTN tab row architecture.

## Tasks

- [x] 1. Navigation overhaul — Replace BottomNavBar with ModalNavigationDrawer + C CAPTN tabs
  - [x] 1.1 Create CCaptnTabRow composable and tab enum
    - Create `ui/navigation/CCaptnTabRow.kt` with `CCaptnTab` enum (Calendar, Checklists, Alarms, Projects, Tasks, Notes) and a `CCaptnTabRow` composable using Material 3 `ScrollableTabRow`
    - Each tab has a label and route string matching existing Screen routes
    - Highlights the currently selected tab
    - _Requirements: 1.1_

  - [x] 1.2 Create SidebarContent composable
    - Create `ui/navigation/SidebarContent.kt` with navigation links (Settings, Contacts, Trash, Help, Weather, Map), a "New Chit" button, and placeholder slots for filter/sort controls
    - Use Material 3 `ModalDrawerSheet` with `NavigationDrawerItem` entries
    - Accept callbacks: `onNavigate(Screen)`, `onNewChit()`, `onClose()`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Update Screen.kt — Add new routes, remove Debug from bottomNavItems
    - Add `Settings`, `Trash`, `Search` sealed class entries to `Screen`
    - Remove `bottomNavItems` list entirely (no longer used)
    - Remove `BottomNavItem` data class
    - _Requirements: 1.1, 2.9_

  - [x] 1.4 Rewrite MainActivity.kt — Replace Scaffold with ModalNavigationDrawer
    - Replace the current `Scaffold` (with `bottomBar = BottomNavBar`) with `ModalNavigationDrawer` wrapping an inner `Scaffold`
    - Inner Scaffold has a `TopAppBar` with hamburger icon button that opens the drawer
    - TopAppBar also shows the version name
    - Wire `CCaptnTabRow` below the TopAppBar (or as part of content) for C CAPTN view switching
    - Remove all references to `BottomNavBar`
    - _Requirements: 1.1, 1.6, 1.7_

  - [x] 1.5 Update CwocNavGraph.kt — Add new routes, remove Debug route
    - Add composable routes for `Screen.Settings`, `Screen.Trash`, `Screen.Search`
    - Remove the `composable(Screen.Debug.route)` block
    - _Requirements: 2.1, 2.9, 11.1_

  - [x] 1.6 Delete BottomNavBar.kt
    - Delete `ui/navigation/BottomNavBar.kt` entirely
    - Verify no remaining imports reference it
    - _Requirements: 2.9_

- [x] 2. Checkpoint — Navigation compiles and runs
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Domain layer — FilterEngine and SortEngine
  - [x] 3.1 Create FilterState data classes
    - Create `domain/filter/FilterState.kt` with `FilterState` data class (statuses, priorities, tags, tagMatchMode, people, showArchived, showPinned, showSnoozed, showPastDue) and `TagMatchMode` enum
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 3.2 Create FilterEngine object
    - Create `domain/filter/FilterEngine.kt` with `object FilterEngine` containing `fun applyFilters(chits: List<ChitEntity>, filters: FilterState): List<ChitEntity>`
    - Implement each predicate: status membership, priority membership, tag match (ANY/ALL), people match, archive/pinned/snoozed toggles, past-due check (compare due_datetime to now)
    - Empty sets mean "any" (no filtering on that dimension)
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 3.3 Create SortEngine object
    - Create `domain/sort/SortEngine.kt` with `object SortEngine`, `SortField` enum (TITLE, DUE_DATE, START_DATE, CREATED_DATE, MODIFIED_DATE, PRIORITY, STATUS, MANUAL), `SortDirection` enum (ASC, DESC), and `SortState` data class
    - Implement `fun sort(chits: List<ChitEntity>, field: SortField, direction: SortDirection): List<ChitEntity>`
    - Handle null values (nulls sort last in ASC, first in DESC)
    - Priority sort uses ordinal: Critical > High > Medium > Low
    - _Requirements: 10.2, 10.3_

  - [x] 3.4 Write property tests for FilterEngine
    - **Property 15: Filter predicate correctness**
    - **Property 16: Tag filter match modes**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

  - [x] 3.5 Write property tests for SortEngine
    - **Property 17: Sort ordering correctness**
    - **Property 6: List reorder preserves items**
    - **Validates: Requirements 10.2, 10.3, 10.5**

- [x] 4. FilterSortViewModel and sidebar filter/sort UI
  - [x] 4.1 Create FilterSortViewModel
    - Create `ui/viewmodel/FilterSortViewModel.kt` as `@HiltViewModel` scoped to activity
    - Holds `FilterState` and `SortState` as `MutableStateFlow`
    - Exposes `fun updateFilter(filter: FilterState)`, `fun updateSort(sort: SortState)`, `fun clearFilters()`
    - Persists sort preference per-tab in SharedPreferences
    - _Requirements: 9.8, 9.9, 10.4_

  - [x] 4.2 Create FilterPanel composable
    - Create `ui/navigation/FilterPanel.kt` — embedded in SidebarContent
    - Status multi-select chips (ToDo, In Progress, Blocked, Complete)
    - Priority multi-select chips (Critical, High, Medium, Low)
    - Tag tree with checkboxes + match mode toggle (ANY/ALL)
    - People chip selection
    - Archive/Pinned/Snoozed toggles
    - Past-due toggle
    - "Clear All Filters" button
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_

  - [x] 4.3 Create SortPanel composable
    - Create `ui/navigation/SortPanel.kt` — embedded in SidebarContent
    - Dropdown or radio group for sort field selection
    - ASC/DESC toggle button
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 4.4 Wire FilterSortViewModel into list view screens
    - Modify `TasksScreen`, `NotesScreen`, `ChecklistsScreen`, `AlertsScreen`, `ProjectsScreen` to accept `FilterSortViewModel` and apply `FilterEngine.applyFilters()` + `SortEngine.sort()` to their chit lists before rendering
    - Show empty state with "No chits match filters" + Clear Filters button when result is empty
    - _Requirements: 9.8, 10.4_

- [x] 5. Checkpoint — Filters and sort working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Settings screen
  - [x] 6.1 Create SettingsFormState and SettingsViewModel
    - Create `ui/screens/settings/SettingsViewModel.kt` as `@HiltViewModel`
    - Inject `SettingsRepository` and `SyncRepository`
    - Load settings into `SettingsFormState` StateFlow on init
    - `fun updateSetting(key: String, value: String)` updates local state
    - `fun save()` persists to Room, marks entity dirty, triggers sync push
    - _Requirements: 2.6, 2.7_

  - [x] 6.2 Create GeneralSettingsTab composable
    - Create `ui/screens/settings/GeneralSettingsTab.kt`
    - Fields: time format (12h/24h toggle), week start day dropdown, calendar snap interval dropdown, snooze length dropdown, default timezone (searchable), unit system toggle
    - _Requirements: 2.3_

  - [x] 6.3 Create ViewsSettingsTab composable
    - Create `ui/screens/settings/ViewsSettingsTab.kt`
    - Fields: default view dropdown, enabled periods checkboxes, view order drag-to-reorder list
    - _Requirements: 2.4_

  - [x] 6.4 Create AdminSettingsTab with Diagnostics section
    - Create `ui/screens/settings/AdminSettingsTab.kt`
    - Migrate all DebugScreen functionality here: Sync Now button, Full Resync button, database stats (total chits, tasks, notes, calendar counts), sync status (status, HWM, last synced), sample chits display, Copy All to Clipboard button
    - Reuse `DebugViewModel` logic (inject same dependencies)
    - _Requirements: 2.8_

  - [x] 6.5 Create SettingsScreen with tab scaffold
    - Create `ui/screens/settings/SettingsScreen.kt` with `TabRow` (General, Views, Admin)
    - TopAppBar with back navigation
    - Wire each tab to its composable
    - _Requirements: 2.1, 2.2_

  - [x] 6.6 Delete DebugScreen and DebugViewModel
    - Delete `ui/screens/debug/DebugScreen.kt` and `ui/screens/debug/DebugViewModel.kt`
    - Remove the `debug/` package directory
    - Verify no remaining references
    - _Requirements: 2.9_

  - [x] 6.7 Write property test for settings round-trip
    - **Property 1: Settings persistence round-trip**
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [x] 7. Checkpoint — Settings screen complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Editor zone infrastructure and DateZone
  - [x] 8.1 Create EditorZoneHeader composable
    - Create `ui/screens/editor/zones/EditorZoneHeader.kt` — reusable collapsible zone header with title, expand/collapse chevron icon, and optional trailing content slot
    - Animated expand/collapse with `AnimatedVisibility`
    - _Requirements: 3.1_

  - [x] 8.2 Create DateZone composable
    - Create `ui/screens/editor/zones/DateZone.kt`
    - Date mode selector: Start/End, Due Only, Perpetual, Point-in-Time, None (radio buttons or segmented control)
    - Show/hide date fields based on mode
    - Use Material 3 `DatePickerDialog` for date selection
    - Use Material 3 `TimePickerDialog` for time selection with snap interval from settings
    - All-Day toggle hides time pickers
    - Timezone field with searchable dropdown of IANA timezones
    - Display dates in user's configured format (12h/24h)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 8.3 Write property tests for date/time utilities
    - **Property 2: Time snap interval**
    - **Property 3: Date/time format correctness**
    - **Property 4: Timezone search filtering**
    - **Validates: Requirements 3.2, 3.4, 3.6**

- [x] 9. ChecklistZone
  - [x] 9.1 Create ChecklistZone composable
    - Create `ui/screens/editor/zones/ChecklistZone.kt`
    - Parse checklist JSON into `ChecklistItem` list using existing `ChecklistOperations`
    - Render items as rows: checkbox + indented text + drag handle
    - Progress count header ("3/7 complete")
    - Add item text input at bottom
    - Swipe-to-delete on items
    - Drag-and-drop reorder (using `LazyColumn` with `DragDropState` or Modifier.draggable)
    - Indent on right-swipe, outdent on left-swipe (or +/- buttons)
    - Undo support: maintain operation stack, expose undo callback
    - Serialize back to JSON on every change
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 9.2 Write property tests for checklist operations
    - **Property 5: Checklist add/remove invariant**
    - **Property 7: Checklist indent/outdent depth**
    - **Property 8: Checklist progress calculation**
    - **Property 9: Checklist undo round-trip**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

- [x] 10. ColorZone
  - [x] 10.1 Create ColorZone composable
    - Create `ui/screens/editor/zones/ColorZone.kt`
    - Grid of color swatches from `DEFAULT_COLOR_PALETTE` constant
    - Additional row for custom colors from user settings
    - Selected color shows checkmark overlay
    - "Clear" button to remove color
    - Visual preview: tint the zone header or show a color indicator bar
    - Immediate visual update on selection
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11. AlertsZone
  - [x] 11.1 Create AlertsZone composable
    - Create `ui/screens/editor/zones/AlertsZone.kt`
    - Parse alerts JSON into `AlertItem` list
    - Display each alert as a row: type icon (alarm/timer/reminder), time/offset text, delete button
    - "Add Alert" button opens a creation form: type selector, offset picker (relative minutes) or absolute time picker, optional label
    - Display times in user's configured format
    - Serialize back to JSON on changes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 11.2 Write property test for alert add/remove
    - **Property 10: Alert list add/remove invariant**
    - **Validates: Requirements 6.2, 6.3**

- [x] 12. RecurrenceZone
  - [x] 12.1 Create RecurrenceZone composable
    - Create `ui/screens/editor/zones/RecurrenceZone.kt`
    - Preset selector: None, Daily, Weekly, Monthly, Yearly
    - Custom builder (shown when "Custom" selected): frequency dropdown, interval number input, by-day checkboxes (Mon–Sun, for weekly), until date picker or count input
    - Human-readable summary text (e.g., "Every Monday and Wednesday")
    - "Clear" button to remove recurrence
    - Recurrence exceptions display (read-only list of excluded dates)
    - Use existing `RecurrenceEngine` for rule generation/parsing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 12.2 Write property tests for recurrence
    - **Property 11: Recurrence rule generation round-trip**
    - **Property 12: Recurrence human-readable summary**
    - **Validates: Requirements 7.2, 7.3**

- [x] 13. Refactor ChitEditorScreen to use zones
  - [x] 13.1 Rewrite ChitEditorScreen with zone-based layout
    - Replace the current flat field list in `ChitEditorScreen.kt` with collapsible zones: Title (always visible), Dates (DateZone), Checklist (ChecklistZone), Color (ColorZone), Alerts (AlertsZone), Recurrence (RecurrenceZone), Tags (existing chip input), People (existing chip input), Location, Notes
    - Each zone uses `EditorZoneHeader` for collapse/expand
    - Pass settings (timeFormat, calendarSnap, timezone, customColors) from SettingsRepository into zones
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 7.1_

- [x] 14. Checkpoint — Editor zones complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Search
  - [x] 15.1 Create SearchViewModel
    - Create `ui/screens/search/SearchViewModel.kt` as `@HiltViewModel`
    - Inject `ChitRepository`, `BooleanSearchParser`, `BooleanSearchEvaluator`
    - `query` MutableStateFlow with 300ms debounce (using `debounce` operator on Flow)
    - Evaluate query against all non-deleted chits
    - Support `field::value`, `#tag`, and boolean operators (&&, ||, !, -prefix)
    - Produce `List<SearchResult>` with matched fields and highlight ranges
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.8_

  - [x] 15.2 Create SearchScreen composable
    - Create `ui/screens/search/SearchScreen.kt`
    - TopAppBar with search text field (auto-focus)
    - Results displayed as chit cards (reuse existing card composable pattern)
    - Highlight matching terms in title/note using `AnnotatedString` with background spans
    - Empty state when no results
    - Back button to return to previous screen
    - _Requirements: 8.1, 8.6, 8.7_

  - [x] 15.3 Add search entry point to header/sidebar
    - Add a search icon button to the main TopAppBar in MainActivity
    - Also add a "Search" navigation item in SidebarContent
    - Both navigate to `Screen.Search`
    - _Requirements: 8.1_

  - [x] 15.4 Write property tests for search
    - **Property 13: Search matches correct fields**
    - **Property 14: Boolean search operator semantics**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

- [x] 16. Trash screen
  - [x] 16.1 Create TrashViewModel
    - Create `ui/screens/trash/TrashViewModel.kt` as `@HiltViewModel`
    - Inject `ChitRepository`
    - Query all chits where `deleted == true` as `StateFlow<List<ChitEntity>>`
    - `fun restore(chitId: String)` — sets deleted=false, marks dirty for sync
    - `fun purge(chitId: String)` — hard-deletes from Room, syncs deletion
    - _Requirements: 11.3, 11.4, 11.6_

  - [x] 16.2 Create TrashScreen composable
    - Create `ui/screens/trash/TrashScreen.kt`
    - TopAppBar with "Trash" title and back navigation
    - List of deleted chits showing: title, deletion date, type indicator chips
    - Each item has "Restore" button and "Purge" button
    - Confirmation dialog before purge ("This cannot be undone")
    - Empty state when trash is empty
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 16.3 Write property tests for trash
    - **Property 18: Trash query returns only deleted chits**
    - **Property 19: Trash restore clears deleted flag**
    - **Validates: Requirements 11.2, 11.3**

- [x] 17. Unsaved changes detection
  - [x] 17.1 Add dirty tracking to ChitEditorViewModel
    - Modify `ui/screens/editor/ChitEditorViewModel.kt`
    - Store `savedState: ChitFormState` snapshot when chit loads or after save
    - Compute `isDirty: StateFlow<Boolean>` by comparing `formState` to `savedState` field-by-field
    - Add `showUnsavedDialog: MutableStateFlow<Boolean>`
    - Add `onBackPressed()` — if dirty, show dialog; else navigate back
    - Add `saveAndExit()`, `discardAndExit()`, `cancelBack()` functions
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 17.2 Add BackHandler and unsaved changes dialog to ChitEditorScreen
    - Modify `ui/screens/editor/ChitEditorScreen.kt`
    - Add `BackHandler` that calls `viewModel.onBackPressed()`
    - Add `AlertDialog` with Save/Discard/Cancel buttons when `showUnsavedDialog` is true
    - Back button priority: close any open zone/modal first, then trigger unsaved check
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 17.3 Write property test for dirty detection
    - **Property 20: Dirty state detection**
    - **Validates: Requirements 12.1**

- [x] 18. Undo on delete
  - [x] 18.1 Create UndoToast composable
    - Create `ui/components/UndoToast.kt`
    - Bottom-positioned bar with message text, countdown progress indicator (5 seconds), and "Undo" button
    - Auto-dismisses after countdown expires (calls `onExpire`)
    - Tapping Undo calls `onUndo` and dismisses immediately
    - Uses `LaunchedEffect` with delay for countdown
    - _Requirements: 13.1, 13.2_

  - [x] 18.2 Wire undo toast into swipe-to-delete flow
    - Modify the swipe-to-delete handling in list view screens (or in `SwipeableChitCard`)
    - On soft-delete: show `UndoToast`, delay actual sync until countdown expires
    - On Undo: restore chit immediately (set deleted=false)
    - On expire: finalize deletion and sync
    - _Requirements: 13.1, 13.3, 13.4_

  - [x] 18.3 Write property test for undo restore
    - **Property 21: Undo restores pre-deletion state**
    - **Validates: Requirements 13.3**

- [x] 19. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Existing domain modules reused: `BooleanSearchParser`, `BooleanSearchEvaluator`, `RecurrenceEngine`, `ChecklistOperations`
- Room database remains at version 5 — no schema changes needed (filter/sort state is in-memory, sort prefs in SharedPreferences)
- All new files go under `android/app/src/main/java/com/cwoc/app/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "3.1"] },
    { "id": 1, "tasks": ["1.4", "1.5", "1.6", "3.2", "3.3"] },
    { "id": 2, "tasks": ["3.4", "3.5", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["6.1", "8.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "8.2"] },
    { "id": 6, "tasks": ["6.5", "6.6", "6.7", "8.3"] },
    { "id": 7, "tasks": ["9.1", "10.1", "11.1", "12.1"] },
    { "id": 8, "tasks": ["9.2", "11.2", "12.2", "13.1"] },
    { "id": 9, "tasks": ["15.1", "16.1", "17.1"] },
    { "id": 10, "tasks": ["15.2", "15.3", "16.2", "17.2"] },
    { "id": 11, "tasks": ["15.4", "16.3", "17.3", "18.1"] },
    { "id": 12, "tasks": ["18.2", "18.3"] }
  ]
}
```
