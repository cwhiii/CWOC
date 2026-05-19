# Implementation Plan: Android Tasks View Parity

## Overview

27 tasks to transform the Android Tasks view into a pixel-perfect replica of the mobile browser version. Tasks are ordered by dependency: data layer first, then shared components, then screen assembly, then gestures, then integration testing.

## Tasks

- [ ] 1. Create SortOrderRepository for manual order persistence (`data/repository/SortOrderRepository.kt`). Methods: getManualOrder(tab), saveManualOrder(tab, ids), loadFromServer(), pushToServer(tab, ids). Store in SharedPreferences keyed by tab. On load, fetch GET /api/sort-orders and merge (server wins). On save, write locally then async PUT /api/sort-orders/{tab}. Inject via Hilt. Requirements: 9.5, 9.6, 9.7, 18.4, 18.5
- [ ] 2. Update SortEngine with default Tasks status sort. Update STATUS_ORDINAL to include empty/null as ordinal 4 (between Blocked=3 and Complete=5), matching web's ordering. Add sortByDefaultTasksOrder() function. Pinned chits still sort to top. Requirements: 9.1
- [ ] 3. Rewrite TasksViewModel with mode toggle, manual order, and prerequisites. Add TasksMode enum (TASKS/HABITS/ASSIGNED), tasksMode StateFlow persisted to SharedPreferences, manualOrder StateFlow from SortOrderRepository, prerequisiteFlags StateFlow computed from all chits. Add setMode(), saveManualOrder(), computePrerequisiteFlags(). Modify sortedFilteredTasks flow to filter by mode, apply FilterEngine, apply SortEngine or default status sort, apply manual order. Requirements: 9.1-9.7, 10.1, 11.1-11.7, 18.1-18.6
- [ ] 4. Create TasksPageShell composable (`ui/screens/tasks/components/TasksPageShell.kt`). Row with background CwocHeaderBg, ~50dp height, 4dp vertical / 8dp horizontal padding, 4dp gap. Elements: hamburger (32dp, CwocPrimary, "☰"), logo (32dp), title ("Omni Chits", Lora 16sp), profile (32dp, pushed right), views button ("☰ Tasks", CwocPrimary, #fff8e1, 36dp min height, bold Lora 14sp). Requirements: 1.1-1.6
- [ ] 5. Create ViewsPanel composable (`ui/screens/tasks/components/ViewsPanel.kt`). AnimatedVisibility with slideInHorizontally from right, 250ms tween. Backdrop (black 40% alpha, clickable close). Panel: 240dp width, full height, parchment bg, 2dp left border #8b4513, shadow, 12dp padding. Header "Views" (1.1em, #4a2c2a, centered, bottom border). 9 view options (icon+label, 44dp min height, styled per spec). Active option: ivory bg, #8b4513 border 2dp. Close button at bottom. Requirements: 2.1-2.8, 2.11
- [ ] 6. Implement ViewsPanel swipe gestures. PointerInput on root Box detecting swipe-left from right edge (25dp zone, >40dp horizontal > vertical). Open panel if sidebar closed. Swipe-right while open closes panel. Requirements: 2.9, 2.10
- [ ] 7. Create TasksSidebar composable (`ui/screens/tasks/components/TasksSidebar.kt`). AnimatedVisibility with slideInHorizontally from left, 300ms tween. Backdrop (black 40% alpha, clickable close). Content: full-width Column, parchment bg, 10dp padding, verticalScroll. Sticky close button at top (full width, #8b4513, "⇤ Hide Sidebar", 44dp min height). Always starts closed. Requirements: 3.1-3.5, 3.8
- [ ] 8. Implement Sidebar swipe gestures. PointerInput on root Box detecting swipe-right from left edge (30dp zone, >50dp horizontal > vertical). Open sidebar if Views panel closed. Swipe-left while open closes sidebar. Requirements: 3.6, 3.7
- [ ] 9. Create ModeToggle composable (`ui/screens/tasks/components/ModeToggle.kt`). Three buttons in Row: "📋 Tasks", "🎯 Habits", "📌 Assigned". Active: ivory bg, color #3b1f0a. Inactive: default parchment styling. On tap calls onModeChange. Requirements: 11.1
- [ ] 10. Create SortControls composable (`ui/screens/tasks/components/SortControls.kt`). Dropdown with options: Title, Start Date, Due Date, Updated, Created, Status, Manual, Random, Upcoming. Direction toggle "▲"/"▼" hidden for Manual/Random/Upcoming. Styled per sidebar section pattern. Requirements: 9.2-9.4
- [ ] 11. Create FiltersSection composable (`ui/screens/tasks/components/FiltersSection.kt`). Collapsible with 200ms opacity animation. Status/priority multi-select checkboxes. Tag filter (chips, search, favorites first, colored dots, Any Tag/Tagless). People filter (chips, profile images). Project dropdown. Text search. Display toggles (12 checkboxes). Clear All button (#a0522d, #fff8e1, 32dp). Requirements: 10.2-10.5
- [ ] 12. Create TaskCard composable (`ui/screens/tasks/components/TaskCard.kt`). Full-width Box, 4dp vertical margin, 10dp padding, 2dp border #8b5a2b, 6dp corner radius. Background from chit color (default #fdf6e3) with contrast text. Lora 14sp, color #2b1e0f, 1.5 line-height. Column: Header → Controls → MapThumbnail. Opacity: completed=0.5, archived=0.45, declined=0.35. Pressed: border #a0522d, shadow. Requirements: 4.1, 6.1-6.5
- [ ] 13. Create TaskCardHeader composable (`ui/screens/tasks/components/TaskCardHeader.kt`). Column: left section (Row, bold 1em, 0.4em gap — icons, indicators, title wrapping) above meta section (FlowRow, 4dp gap, 12sp, 0.85 opacity — priority, dates, tags, RSVP, shared, assignee). Status hidden. Bold+arrow on active sort field. Requirements: 4.2-4.6
- [ ] 14. Create StatusDropdown composable (`ui/screens/tasks/components/StatusDropdown.kt`). Row: status icon + "Status:" + dropdown. Icons per status (Material equivalents of FA icons). Options: ToDo/InProgress/Blocked/Complete/Rejected. "Blocked ⛓️" when prereqs incomplete. Dynamic styling: Blocked=gold+bold, Complete=0.6 opacity, Rejected=gray+0.6. Disabled for viewer role. Min 36dp, 14sp. Requirements: 5.2-5.9
- [ ] 15. Create NotePreview composable (`ui/screens/tasks/components/NotePreview.kt`). Render markdown (500 chars) via MarkdownRenderer. Max 3 lines collapsed, overflow hidden. 0.75 opacity, 1.4em line-height. Toggle "show more…"/"show less" (12sp, #8b5a2b, italic, right-aligned). Requirements: 5.10, 5.11
- [ ] 16. Create TaskCardControls composable (`ui/screens/tasks/components/TaskCardControls.kt`). Column, 6dp gap. Background rgba(0,0,0,0.04), 3dp corner radius, 4dp/8dp padding. Contains StatusDropdown then NotePreview (if note exists). Requirements: 5.1
- [ ] 17. Create MapThumbnail composable (`ui/screens/tasks/components/MapThumbnail.kt`). 90dp×60dp, 4dp corner radius, 1dp border, 6dp top margin, aligned end. OSM tile via Coil/AsyncImage. Pin overlay centered. Background #f5ebe0 while loading. Double-tap → maps. Only if non-default location and setting enabled. Requirements: 7.1-7.3
- [ ] 18. Create VisualIndicators utility (`ui/screens/tasks/components/VisualIndicators.kt`). Function buildIndicatorString(chit, settings): String. Logic for alerts (combined/individual), people, health, custom data, habit, recurrence, attachments. Respect display modes. Weather indicator with tooltip. Requirements: 13.1-13.3
- [ ] 19. Create TouchGestureHandler (`ui/screens/tasks/gesture/TouchGestureHandler.kt`). Modifier.taskCardGesture extension using pointerInput/awaitPointerEventScope. 400ms hold → drag (30ms haptic). >10dp before 400ms → cancel/scroll. Movement after drag → cancel long-press. 1200ms still → long-press (pattern vibration). Double-tap (300ms window). Post-drag suppression (300ms). Requirements: 8.1-8.4, 8.9-8.11, 21.1-21.3
- [ ] 20. Create DragReorderController (`ui/screens/tasks/gesture/DragReorderController.kt`). DragReorderState class. On start: record rect, placeholder, float card (0.9 opacity, shadow). On move: follow finger, calculate insertion from Y, move placeholder. Auto-scroll 50dp edge zone, 8dp/frame. On end: insert at placeholder, save order, switch to manual sort. Drag visual: scale 1.04, pulsing outline. Requirements: 8.5-8.8
- [ ] 21. Create EmptyState composable (`ui/screens/tasks/components/EmptyState.kt`). Centered Column, 0.7 opacity, 32dp vertical / 16dp horizontal padding. Message "No tasks found." or "No chits assigned to you." at 18sp, 12dp bottom margin. "+ Create Chit" button navigating to editor. Requirements: 12.1, 12.2
- [ ] 22. Rewrite TasksScreen with all new components. Root Box(fillMaxSize, parchment bg). Layer 1: Column with TasksPageShell + LazyColumn (4dp padding, 6dp spacing). Layer 2: TasksSidebar overlay. Layer 3: ViewsPanel overlay. Layer 4: DragOverlay. Wire all state. Content never shifts. Task list fills below header. Overscroll contain. Requirements: 19.1-19.4
- [ ] 23. Wire up status change API call in TasksViewModel. updateStatus(chitId, newStatus): update locally via ChitDao, mark dirty, push if online, refresh flow. Connect StatusDropdown onChange. Requirements: 5.9, 18.3
- [ ] 24. Implement shared chit behavior in TaskCard. Check effectiveRole=="viewer" to disable dropdown and suppress long-press. Display 🔗 with tooltip, RSVP indicators (✓/✗/⏳), RSVP action buttons for non-owner. Declined=0.35 opacity. Requirements: 20.1-20.3
- [ ] 25. Verify color system completeness in Color.kt. Confirm all required colors exist. Add missing named colors. Verify card default #fdf6e3 and contrast logic. Verify overdue #b22222 and blocked #DAA520. Requirements: 14.1-14.4
- [ ] 26. Verify typography setup. Confirm Lora variable font bundled. Confirm Type.kt uses Lora primary with serif fallbacks. Verify title bold (700), meta ~12sp, note preview default weight 22sp line-height. Requirements: 16.1-16.3
- [ ] 27. Integration testing — visual parity check. Side-by-side comparison with mobile browser. Verify header, cards, status dropdown, overdue styling, tag chips, opacity states, empty state, sidebar, views panel all match. Requirements: All

## Task Dependency Graph

```json
{
  "waves": [
    [1, 2, 25, 26],
    [3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    [6, 8, 22, 23, 24],
    [27]
  ]
}
```

Tasks 1-2 must complete before 3. Tasks 4-21 can be built in parallel (wave 2). Task 3 and all of 4-21 must complete before 22. Tasks 6 and 8 (swipe gestures) depend on 5 and 7 respectively. Tasks 23-24 can be done during or after 22. Task 27 is the final verification step.

## Notes

- The existing `ChitListScaffold` is NOT used by the new Tasks view — it's replaced entirely by the custom page shell. Other views (Notes, Calendar, etc.) continue using it.
- The existing `FilterSortViewModel` (activity-scoped) continues to hold shared filter/sort state. The TasksViewModel reads from it and adds Tasks-specific logic (mode, manual order, prerequisites).
- Font loading is already handled — Lora is bundled in app assets and configured in Type.kt.
- Most theme colors already exist in Color.kt — Task 25 is a verification step, not a major implementation.
