# F — Editor Task (4 items: F1–F4)

## Status: COMPLETE — all 4 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorViewModel.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/tasks/TasksScreen.kt`

---

## F1 — Assignee dropdown has EMPTY options ✅ COMPLETE (3/3 sub-items)

1. ✅ `loadEditorSettings()` now parses `settings.kioskUsers` JSON array via Gson
2. ✅ Parsed into `List<String>` and assigned to `EditorSettings.sharedUsers`
3. ✅ Assignee dropdown populated from synced settings data

## F2 — Auto-Complete Checklist not in zone header button ✅ COMPLETE (3/3 sub-items)

1. ✅ Auto-Complete toggle moved to compact row in Task section (alongside Habit toggle)
2. ✅ Quick access without scrolling — visible in the Task section header area
3. ✅ Uses compact `labelSmall` text + Switch for minimal space

## F3 — Habit toggle not in zone header button ✅ COMPLETE (3/3 sub-items)

1. ✅ Habit toggle added to compact row in Task section (alongside Auto-Complete)
2. ✅ Quick access without expanding the Habits zone
3. ✅ Both toggles in a single row for efficient space usage

## F4 — No inline status change dropdown on list cards ✅ COMPLETE (3/3 sub-items)

1. ✅ Inline status chip on TaskCard — colored background pill showing current status
2. ✅ Tapping the chip opens a DropdownMenu with all 5 status options
3. ✅ `onStatusChange: ((String, String) -> Unit)?` callback for updating status without opening editor
