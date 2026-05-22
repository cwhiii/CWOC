# Implementation Plan: New Chit Zone Prefill

## Overview

Implement context-aware zone pre-opening when creating new chits from specific C CAPTN views. Updates the zone prefill mapping, adds auto-focus behavior for Notes/Checklists, adds due date pre-selection for Tasks, and wires up the sourceTab navigation argument on Android.

## Tasks

- [x] 1. Update web desktop zone prefill map in `_collapseAllZonesForNewChit()` in `src/frontend/js/editor/editor-init.js`: change Tasks to `[['taskSection', 'taskContent'], ['datesSection', 'datesContent']]`, Projects to `[['projectsSection', 'projectsContent'], ['checklistSection', 'checklistContent']]`, and Indicators to `[['healthIndicatorsSection', 'healthIndicatorsContent']]` (removing the extra datesSection that was there before)
- [x] 2. Add auto-focus logic in `_collapseAllZonesForNewChit()` after zone expansion: Notes → focus `#note` textarea; Checklists → focus first checklist input in `#checklistContent`; Tasks → call `_setDateMode('due')` with unsaved suppression, add `.cwoc-prefill-highlight` to `#due_datetime` with one-time focus listener to remove it
- [x] 3. Add `.cwoc-prefill-highlight` CSS class to `src/frontend/css/shared/shared-editor.css` with a pulsing outline animation (2px solid #8b5a2b, pulse to #d4a574, 1.5s ease-in-out, 2 iterations)
- [x] 4. Update `_mobileTabZoneMap` in `src/frontend/js/editor/editor-mobile-zones.js`: change Projects to `'projectsSection'`, add `'Indicators': 'healthIndicatorsSection'`
- [x] 5. Add auto-focus logic in `_mobileShowZone()` for new chits: when `window.isNewChit` and sourceTab is Notes/Checklists, focus the appropriate input after 150ms; when Tasks, call `_setDateMode('due')`; use `_mobileAutoFocusDone` flag to fire only once
- [x] 6. Update `Screen.Editor` route in `android/.../ui/navigation/Screen.kt` to include `sourceTab` query parameter and update `createRoute()` to accept optional `sourceTab: String?`
- [x] 7. Update `CwocNavGraph.kt` editor composable to add `sourceTab` navArgument (nullable String, null default), extract it from backStackEntry, and pass to `ChitEditorScreen`
- [x] 8. Update `MainActivity.kt` FAB `onTap` to pass `selectedTab.label` as sourceTab when navigating to new chit editor
- [x] 9. Update `ChitEditorScreen` to accept `sourceTab: String?` parameter and pass it to `rememberEditorZoneState()`
- [x] 10. Update `SOURCE_TAB_ZONE_MAP` in `EditorZoneNav.kt`: change Projects to `"projectsSection"`, verify Indicators entry exists
- [x] 11. Add `ZONE_PREFILL_MAP` constant in `EditorZoneNav.kt` mapping each source tab to its list of zone IDs to show in overview
- [x] 12. Update `buildOverviewRows()` in `EditorZoneState.kt` to accept `sourceTab` parameter and include placeholder rows for prefill zones when `formState.isNew && sourceTab != null`
- [x] 13. Add auto-focus `LaunchedEffect` in `ChitEditorScreen` for Notes (focus notes OutlinedTextField) and Checklists (focus first checklist input) with 300ms delay and FocusRequester
- [x] 14. Add `highlightDueDate` parameter to `DateZone` composable; when true, set initial date mode to Due and apply visual highlight to due date field that clears on interaction
- [x] 15. Update help documentation in `src/help/` to describe the new zone prefill behavior when creating chits from specific views
- [x] 16. Update `src/INDEX.md` with any new functions/constants, bump version numbers (`src/VERSION` and `android/app/build.gradle.kts` versionName), and create/update daily release notes

## Task Dependency Graph

```json
{
  "waves": [
    {"wave": 1, "tasks": [1, 3, 4, 6, 10]},
    {"wave": 2, "tasks": [2, 5, 7, 11]},
    {"wave": 3, "tasks": [8, 9, 12]},
    {"wave": 4, "tasks": [13, 14]},
    {"wave": 5, "tasks": [15]},
    {"wave": 6, "tasks": [16]}
  ]
}
```

## Notes

- Tasks 1–5 (web) and Tasks 6–14 (Android) are independent tracks that can be worked in parallel
- The web already has the source tab propagation via localStorage — no changes needed there
- The Android app's zone-at-a-time navigation means "multiple zones open" translates to "start on the primary zone with prefill zones shown in overview"
- No backend changes required — this is purely a frontend/client feature
- No new external dependencies needed
