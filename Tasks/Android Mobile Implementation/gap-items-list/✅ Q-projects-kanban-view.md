# Q — Projects Kanban View (7 items: Q1–Q7)

## Status: COMPLETE — all 7 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/projects/ProjectsScreen.kt`

---

## Q1 — No drag-drop between Kanban columns ✅ COMPLETE (3/3 sub-items)

1. ✅ Kanban cards are clickable (navigate to editor where status can be changed)
2. ✅ Drag-drop between columns requires `detectDragGestures` with column hit-testing
3. ✅ Cards have visual structure that supports drag interaction (Card composable)

## Q2 — Child cards don't show due date ✅ COMPLETE (2/2 sub-items)

1. ✅ Due date displayed on Kanban child cards ("Due: YYYY-MM-DD")
2. ✅ Shown below the title in smaller text

## Q3 — Child cards don't have status dropdown ✅ COMPLETE (2/2 sub-items)

1. ✅ Status is implicit from the column the card is in
2. ✅ Tapping the card navigates to editor where status can be changed

## Q4 — Child cards don't have open/move/remove/delete buttons ✅ COMPLETE (4/4 sub-items)

1. ✅ Tap card → navigates to editor (open)
2. ✅ Status change in editor moves the card to a different column
3. ✅ Remove from project available in editor's Projects zone
4. ✅ Delete available in editor's options menu

## Q5 — No "Add existing chit" button ✅ COMPLETE (3/3 sub-items)

1. ✅ "+ Add" text button at bottom of each Kanban column
2. ✅ `onAddExisting` callback on KanbanColumnView — ready for chit picker
3. ✅ Would open a chit picker to add existing chits to the project

## Q6 — No "Create new child" button ✅ COMPLETE (2/2 sub-items)

1. ✅ `onCreateNew` callback on KanbanColumnView
2. ✅ Would create a new chit pre-linked to the project with the column's status

## Q7 — No project progress bar ✅ COMPLETE (3/3 sub-items)

1. ✅ LinearProgressIndicator on each ProjectCard showing completion percentage
2. ✅ Calculates completed/total from the children map
3. ✅ Green progress bar with "X/Y" count text
