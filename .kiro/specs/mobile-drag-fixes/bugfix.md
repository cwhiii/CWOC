# Bugfix Requirements Document

## Introduction

Mobile touch drag is broken or inconsistent across several dashboard views. The app already has a unified touch gesture system in `shared-touch.js` with two functions: `enableTouchDrag()` (drag-only) and `enableTouchGesture()` (drag + long-press). The working views (Checklists, Tasks, Alarms chit-attached) use `enableDragToReorder()` from `shared-sort.js`, which internally calls `enableTouchGesture()` with a per-card long-press map. The fix must ensure ALL views use this same unified pattern — `enableTouchGesture()` for drag + view-specific long-press action — rather than each view having its own ad-hoc touch handling. The long-press action varies by view (quick-edit modal on Calendar/Checklists/Tasks/Alarms/Projects, inline note editing on Notes) but the gesture mechanics must be identical everywhere.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user completes a touch drag operation on a calendar event (timed, month, or all-day) THEN the system incorrectly fires the quick-edit popup because calendar events use the deprecated standalone `enableLongPress()` function which runs independently from the drag system, creating a race condition where the long-press timer fires after a drag completes despite the `_dragJustEnded` flag

1.2 WHEN a user attempts to touch-drag a note card in the Notes view on mobile THEN the drag does not work reliably because although `enableNotesDragReorder` calls `enableTouchGesture`, the notes masonry layout uses absolute positioning which causes `elementFromPoint` drop targeting to malfunction during the drag operation

1.3 WHEN a user attempts to touch-drag a project header (kanban-project-box) in the Projects kanban view on mobile THEN the system does not respond because no touch gesture handler is attached to project header elements — only HTML5 drag events are wired, which do not fire on mobile touch devices

1.4 WHEN a user attempts to touch-drag any project header or child item in the Projects list view on mobile THEN the system does not respond because the list view only wires HTML5 drag events for child items and has no touch gesture setup for project-level reordering at all

1.5 WHEN a user views the independent alerts board (standalone alarms/timers/stopwatches) on mobile THEN the system provides no drag-to-reorder capability because `_displayIndependentAlertsBoard` does not call any drag or touch gesture setup function

1.6 WHEN a user attempts to touch-drag chit cards in the Indicators (health trends) view on mobile THEN the system provides no drag-to-reorder capability because `displayIndicatorsView` does not call `enableDragToReorder` or any touch gesture setup, despite the cards being reorderable in other views

### Expected Behavior (Correct)

2.1 WHEN a user touch-drags a calendar event on mobile THEN the system SHALL use the unified `enableTouchGesture()` pattern (replacing the deprecated `enableLongPress()` call in `attachCalendarChitEvents`) so that drag and long-press are coordinated through a single gesture system — drag activates after a short hold, long-press (quick-edit) only fires if the user holds perfectly still for the full duration, and once a drag starts, long-press is permanently cancelled

2.2 WHEN a user touch-drags a note card in the Notes view on mobile THEN the system SHALL allow the card to be dragged between columns and reordered within columns using the unified `enableTouchGesture()` pattern, with correct drop targeting that accounts for the absolute-positioned masonry layout, and long-press SHALL trigger inline note editing

2.3 WHEN a user touch-drags a project header in the Projects kanban view on mobile THEN the system SHALL allow the project to be reordered among other projects using the unified `enableTouchGesture()` pattern attached to the project header element, with long-press opening the quick-edit modal or navigating to the editor

2.4 WHEN a user touch-drags a project header or child item in the Projects list view on mobile THEN the system SHALL allow reordering using the unified `enableTouchGesture()` pattern for both project headers and child items, with long-press opening the quick-edit modal

2.5 WHEN a user views the independent alerts board on mobile THEN the system SHALL either provide drag-to-reorder for standalone alert cards using the unified touch gesture pattern, or clearly indicate that reordering is not applicable for standalone alerts

2.6 WHEN a user touch-drags chit cards in the Indicators (health trends) view on mobile THEN the system SHALL allow drag-to-reorder using the unified `enableTouchGesture()` pattern via `enableDragToReorder`, with long-press opening the quick-edit modal

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user touch-drags a chit card in the Checklists view on mobile THEN the system SHALL CONTINUE TO allow drag-to-reorder with the unified touch gesture system (drag + long-press for quick-edit) as it currently works via `enableDragToReorder`

3.2 WHEN a user touch-drags a chit card in the Tasks view on mobile THEN the system SHALL CONTINUE TO allow drag-to-reorder with the unified touch gesture system (drag + long-press for quick-edit) as it currently works via `enableDragToReorder`

3.3 WHEN a user touch-drags a chit card in the Alarms view (chit-attached mode) on mobile THEN the system SHALL CONTINUE TO allow drag-to-reorder with the unified touch gesture system (drag + long-press for quick-edit) as it currently works via `enableDragToReorder`

3.4 WHEN a user touch-drags a calendar event to move or resize it on mobile THEN the system SHALL CONTINUE TO allow the drag-move and drag-resize operations via `enableTouchDrag` in `enableCalendarDrag` as they currently work

3.5 WHEN a user touch-drags a checklist item within or between chits on mobile THEN the system SHALL CONTINUE TO allow checklist item reordering via `enableTouchDrag` in `renderInlineChecklist` as it currently works

3.6 WHEN a user touch-drags a kanban child card between status columns on mobile THEN the system SHALL CONTINUE TO allow cross-column status changes via `enableTouchGesture` as it currently works in the kanban view

3.7 WHEN a user performs a long-press on a chit card in Checklists or Tasks view on mobile THEN the system SHALL CONTINUE TO open the quick-edit modal via the `enableTouchGesture` long-press callback

3.8 WHEN a user uses mouse-based drag on desktop in any view THEN the system SHALL CONTINUE TO support HTML5 drag-and-drop reordering as it currently works

3.9 WHEN a user shift-clicks a calendar event on desktop THEN the system SHALL CONTINUE TO open the quick-edit modal as it currently works

3.10 WHEN a user double-clicks any chit card or calendar event THEN the system SHALL CONTINUE TO navigate to the editor page as it currently works
