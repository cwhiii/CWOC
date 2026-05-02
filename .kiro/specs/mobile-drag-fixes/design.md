# Mobile Touch Drag Fixes — Bugfix Design

## Overview

Six views on the CWOC dashboard have broken or missing mobile touch drag support. The root cause across all six is inconsistent adoption of the unified gesture system (`enableTouchGesture()` from `shared-touch.js`). The working views (Checklists, Tasks, Alarms chit-attached) all use `enableDragToReorder()` from `shared-sort.js`, which internally wires both HTML5 drag and `enableTouchGesture()`. The fix standardizes all views on this same pattern, replacing ad-hoc touch handling (Calendar's `enableLongPress`) and adding missing touch gesture setup (Projects kanban headers, Projects list, Independent Alerts, Indicators).

## Glossary

- **Bug_Condition (C)**: A touch interaction on a dashboard view element that either (a) triggers an unintended side effect (Calendar quick-edit after drag), (b) fails to initiate drag despite the element being draggable (Notes, Projects kanban headers, Projects list), or (c) has no drag capability at all despite being reorderable content (Independent Alerts, Indicators)
- **Property (P)**: All draggable view elements use `enableTouchGesture()` as the single gesture system — drag activates after 400ms hold, long-press fires only after 1200ms of perfect stillness, and once drag starts long-press is permanently cancelled
- **Preservation**: All existing working touch behaviors (Checklists, Tasks, Alarms chit-attached drag+long-press; Calendar drag-move/resize; Kanban child card cross-column drag; Checklist item reorder; Desktop HTML5 drag; shift-click quick-edit; double-click navigation) must remain unchanged
- **`enableTouchGesture()`**: The unified gesture function in `shared-touch.js` that coordinates drag (400ms hold) and long-press (1200ms hold) sequentially, guaranteeing mutual exclusion
- **`enableTouchDrag()`**: The drag-only touch adapter in `shared-touch.js`, used by calendar move/resize and checklist items (no long-press needed)
- **`enableDragToReorder()`**: The high-level reorder function in `shared-sort.js` that wires both HTML5 drag events and `enableTouchGesture()` with an optional per-card long-press map
- **`enableLongPress()`**: DEPRECATED standalone long-press handler in `shared.js` that runs independently from the drag system, causing race conditions
- **`attachCalendarChitEvents()`**: Function in `main-calendar.js` that attaches dblclick, shift-click, and (currently) `enableLongPress` to calendar event elements
- **`enableNotesDragReorder()`**: Function in `shared.js` that wires mouse drag and `enableTouchGesture` for notes cards with masonry-aware drop targeting
- **`elementFromPoint()`**: Browser API used during touch drag to find the drop target under the finger — fails when elements have absolute positioning with overlapping bounds

## Bug Details

### Bug Condition

The bug manifests across six views when a user performs touch interactions on mobile. Each defect has a distinct trigger but shares a common root cause: the view either uses the wrong gesture system or has no touch gesture system at all.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { view: string, element: DOMElement, gesture: 'drag' | 'long-press' }
  OUTPUT: boolean

  // Defect 1: Calendar long-press races with drag
  IF input.view == 'Calendar'
     AND input.element matches '.timed-event, .month-event, .all-day-event, .day-event, .itinerary-event'
     AND input.gesture == 'drag'
     AND element has enableLongPress() attached independently from enableTouchDrag()
  THEN RETURN true

  // Defect 2: Notes drag fails due to masonry absolute positioning
  IF input.view == 'Notes'
     AND input.element matches '.chit-card' inside notes masonry container
     AND input.gesture == 'drag'
     AND container uses absolute positioning for cards
     AND elementFromPoint returns wrong target during drag
  THEN RETURN true

  // Defect 3: Kanban project headers have no touch gesture
  IF input.view == 'Projects' AND projectsViewMode == 'kanban'
     AND input.element matches '.kanban-project-header'
     AND input.gesture == 'drag'
     AND element._touchGestureCleanup is undefined
  THEN RETURN true

  // Defect 4: Projects list view has no touch gesture for project headers
  IF input.view == 'Projects' AND projectsViewMode == 'list'
     AND (input.element matches project header OR input.element matches '.projects-child-item')
     AND input.gesture == 'drag'
     AND element._touchGestureCleanup is undefined
  THEN RETURN true

  // Defect 5: Independent alerts board has no drag at all
  IF input.view == 'Alarms' AND alarmsViewMode == 'independent'
     AND input.element matches '.sa-card'
     AND input.gesture == 'drag'
  THEN RETURN true

  // Defect 6: Indicators view has no drag-to-reorder
  IF input.view == 'Indicators'
     AND input.element matches indicator latest-value card
     AND input.gesture == 'drag'
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Defect 1**: User holds finger on a timed calendar event for 400ms, drag activates and they move the event to a new time slot. After releasing, the `enableLongPress` timer (which started independently at touchstart) fires and opens the quick-edit popup. Expected: no popup after drag.
- **Defect 2**: User holds finger on a note card, drag activates, they move the card toward another column. `elementFromPoint()` returns the wrong card (or no card) because absolute-positioned cards overlap in the masonry layout. The card drops in the wrong position or the drop is ignored. Expected: correct drop targeting.
- **Defect 3**: User holds finger on a kanban project header (the "≡ Project Title" bar). Nothing happens — no drag activation, no visual feedback. The header only has HTML5 `dragstart`/`dragend` events which don't fire on touch. Expected: drag activates after 400ms hold.
- **Defect 4**: User holds finger on a project header or child item in list view. Nothing happens for project headers (no touch handlers at all). Child items have HTML5 drag only. Expected: touch drag for both.
- **Defect 5**: User tries to reorder standalone alarm/timer/stopwatch cards. No drag capability exists. Expected: drag-to-reorder within each type column.
- **Defect 6**: User tries to reorder indicator latest-value cards. No drag capability exists. Expected: drag-to-reorder for indicator cards (reorder persisted to localStorage).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Checklists view: touch drag-to-reorder with long-press quick-edit via `enableDragToReorder()` continues to work
- Tasks view: touch drag-to-reorder with long-press quick-edit via `enableDragToReorder()` continues to work
- Alarms chit-attached view: touch drag-to-reorder with long-press quick-edit via `enableDragToReorder()` continues to work
- Calendar drag-move and drag-resize via `enableTouchDrag()` in `enableCalendarDrag()` continues to work
- Checklist item reordering within/between chits via `enableTouchDrag()` continues to work
- Kanban child card drag between status columns via `enableTouchGesture()` continues to work
- Long-press on Checklists/Tasks cards opens quick-edit modal
- Desktop HTML5 drag-and-drop in all views continues to work
- Shift-click on calendar events opens quick-edit modal on desktop
- Double-click on any chit card or calendar event navigates to editor

**Scope:**
All inputs that do NOT involve the six defective touch interactions should be completely unaffected by this fix. This includes:
- Mouse-based drag on desktop in any view
- Keyboard interactions
- All existing touch gestures on working views (Checklists, Tasks, Alarms chit-attached)
- Calendar drag-move/resize touch interactions (these use `enableTouchDrag` directly, not `enableLongPress`)
- Checklist item touch drag

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Calendar — Parallel gesture systems (Defect 1)**: `attachCalendarChitEvents()` in `main-calendar.js` calls `enableLongPress()` which attaches its own independent `touchstart`/`touchmove`/`touchend` listeners. Meanwhile, `enableCalendarDrag()` in `shared-calendar.js` attaches `enableTouchDrag()` on the same elements for move/resize. These two systems run in parallel — `enableLongPress` starts its 1200ms timer at `touchstart` and only checks `_touchDragActive`/`_dragJustEnded` when the timer fires, but by then the drag may have already completed and the flags cleared. The fix is to replace `enableLongPress()` with the calendar event's long-press being coordinated through `enableTouchGesture()` or by integrating the long-press callback into the existing `enableTouchDrag()` call path.

2. **Notes — `elementFromPoint` vs absolute positioning (Defect 2)**: `enableNotesDragReorder()` uses `enableTouchGesture()` correctly for the gesture mechanics, but the `onDragMove` handler calls `_onNotesDragMoveXY()` which repositions the dragged card with absolute positioning. The issue is that `elementFromPoint()` during the live preview may hit the dragged card itself (since it's floating under the finger) or miss target cards whose visual positions don't match their DOM positions. The fix is to temporarily hide the dragged card from hit testing (via `pointer-events: none`) before calling `elementFromPoint`, then restore it.

3. **Projects kanban headers — No touch gesture (Defect 3)**: `_displayProjectsKanban()` attaches HTML5 `dragstart`/`dragend` on `projectBox` and `dragover`/`drop` on the wrapper for project-level reorder. Touch gesture (`enableTouchGesture`) is only attached to child cards within kanban columns, not to project headers. The fix is to add `enableTouchGesture()` to each `kanban-project-header` element with drag callbacks that mirror the HTML5 project reorder logic.

4. **Projects list — No touch gesture (Defect 4)**: `displayProjectsView()` (list mode) attaches HTML5 drag events to child items (`projects-child-item`) and `enableTouchGesture()` for child items within each project's tree. However, there is no project-level reorder capability at all in list mode (neither HTML5 nor touch). The fix is to add project-level reorder (both HTML5 drag and `enableTouchGesture()`) to project header elements in list view.

5. **Independent Alerts — No drag capability (Defect 5)**: `_displayIndependentAlertsBoard()` renders cards in three type columns but has no drag-to-reorder setup. The cards use `data-alert-id` rather than `data-chit-id` since they're standalone alerts stored in settings, not chits. The fix is to add touch drag-to-reorder within each type column, persisting order to the backend via `_updateIndependentAlert()` or localStorage.

6. **Indicators — No drag capability (Defect 6)**: `displayIndicatorsView()` renders latest-value cards and chart sections but has no reorder capability. The latest-value cards are data visualization elements, not chit cards. The fix is to add drag-to-reorder for the chart sections (the `div[data-ind-key]` elements), persisting the display order to localStorage.

## Correctness Properties

Property 1: Bug Condition — Calendar drag does not trigger quick-edit

_For any_ calendar event element where a touch drag gesture occurs (hold 400ms then move), the fixed code SHALL NOT fire the quick-edit modal, because the deprecated `enableLongPress()` call has been removed from `attachCalendarChitEvents()` and replaced with a long-press callback coordinated through the unified gesture system.

**Validates: Requirements 1.1, 2.1**

Property 2: Bug Condition — Notes drag targets correctly despite masonry layout

_For any_ note card drag in the Notes view where the masonry layout uses absolute positioning, the fixed `_onNotesDragMoveXY()` SHALL correctly identify the drop target card by temporarily removing the dragged card from hit testing before calling `elementFromPoint()`.

**Validates: Requirements 1.2, 2.2**

Property 3: Bug Condition — Projects kanban headers are touch-draggable

_For any_ project header element in the Projects kanban view, the fixed code SHALL have `enableTouchGesture()` attached, enabling touch drag-to-reorder of projects and long-press to open the editor.

**Validates: Requirements 1.3, 2.3**

Property 4: Bug Condition — Projects list view elements are touch-draggable

_For any_ project header or child item in the Projects list view, the fixed code SHALL have `enableTouchGesture()` attached, enabling touch drag-to-reorder and long-press for quick-edit.

**Validates: Requirements 1.4, 2.4**

Property 5: Bug Condition — Independent alerts support touch drag-to-reorder

_For any_ standalone alert card in the independent alerts board, the fixed code SHALL support touch drag-to-reorder within each type column using `enableTouchGesture()`.

**Validates: Requirements 1.5, 2.5**

Property 6: Bug Condition — Indicators view supports touch drag-to-reorder

_For any_ indicator chart section in the Indicators view, the fixed code SHALL support touch drag-to-reorder using `enableTouchGesture()`, with the display order persisted to localStorage.

**Validates: Requirements 1.6, 2.6**

Property 7: Preservation — Existing working views unchanged

_For any_ touch interaction on Checklists, Tasks, or Alarms (chit-attached) views, the fixed code SHALL produce exactly the same behavior as the original code, preserving drag-to-reorder and long-press quick-edit functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.7**

Property 8: Preservation — Calendar drag-move/resize unchanged

_For any_ calendar event drag-move or drag-resize touch interaction, the fixed code SHALL produce exactly the same behavior as the original code, preserving the `enableTouchDrag()` mechanics in `enableCalendarDrag()`.

**Validates: Requirements 3.4, 3.9**

Property 9: Preservation — Desktop and non-touch interactions unchanged

_For any_ mouse-based drag, shift-click, or double-click interaction on desktop, the fixed code SHALL produce exactly the same behavior as the original code.

**Validates: Requirements 3.8, 3.9, 3.10**

Property 10: Preservation — Checklist item and kanban child drag unchanged

_For any_ checklist item reorder or kanban child card cross-column drag via touch, the fixed code SHALL produce exactly the same behavior as the original code.

**Validates: Requirements 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/frontend/js/dashboard/main-calendar.js`

**Function**: `attachCalendarChitEvents()`

**Specific Changes**:
1. **Remove `enableLongPress()` call**: Delete the `if (typeof enableLongPress === 'function')` block that independently attaches long-press to calendar event elements
2. **Add `enableTouchGesture()` for long-press only**: Replace with `enableTouchGesture(el, { onLongPress: callback })` where the callback opens quick-edit. Since calendar events already have `enableTouchDrag()` for move/resize via `enableCalendarDrag()`, we only need the long-press path here. The `enableTouchGesture` will clean up any existing `enableTouchDrag` on the element, so the order matters — `attachCalendarChitEvents` must be called BEFORE `enableCalendarDrag` sets up `enableTouchDrag`, OR we use a different approach: attach the long-press callback directly into the `enableTouchDrag` call in `enableCalendarDrag` by switching to `enableTouchGesture` there.
3. **Preferred approach — integrate into `enableCalendarDrag`**: Modify `enableCalendarDrag()` in `shared-calendar.js` to accept an optional `onLongPress` callback per element. When provided, use `enableTouchGesture()` instead of `enableTouchDrag()` for the move gesture, passing both drag and long-press callbacks. This keeps the gesture coordination in one place per element. Then `attachCalendarChitEvents` passes the quick-edit callback through to `enableCalendarDrag`.

---

**File**: `src/frontend/js/shared/shared.js`

**Function**: `enableNotesDragReorder()` → `_onNotesDragMoveXY()`

**Specific Changes**:
1. **Hide dragged card from hit testing**: Before calling `elementFromPoint()` in `_onNotesDragMoveXY()`, set `pointer-events: none` on the dragged card, then restore it after the call. This prevents `elementFromPoint` from returning the dragged card itself.
2. **Use column-based targeting as fallback**: If `elementFromPoint` still returns null (finger is between cards), calculate the target column from the cursor X position and find the nearest card by Y position within that column. The existing code already does column calculation — the fix ensures the card-level targeting works with absolute positioning.

---

**File**: `src/frontend/js/dashboard/main-views.js`

**Function**: `_displayProjectsKanban()`

**Specific Changes**:
1. **Add `enableTouchGesture()` to project headers**: After rendering all project boxes, iterate over `.kanban-project-header` elements and attach `enableTouchGesture()` with drag callbacks that mirror the HTML5 project-level reorder logic (reorder project boxes, save to manual order, refresh).
2. **Long-press on header**: Opens the project in the editor (same as dblclick).

---

**File**: `src/frontend/js/dashboard/main-views.js`

**Function**: `displayProjectsView()` (list mode)

**Specific Changes**:
1. **Add project-level reorder**: Add HTML5 drag events and `enableTouchGesture()` to project header elements for reordering projects in list view. Mirror the kanban project reorder pattern.
2. **Add long-press to project headers**: Long-press opens quick-edit modal for the project.
3. **Add long-press to child items**: The existing `enableTouchGesture()` on child items already has long-press for quick-edit — verify this is working correctly.

---

**File**: `src/frontend/js/dashboard/main-views.js`

**Function**: `_displayIndependentAlertsBoard()`

**Specific Changes**:
1. **Add touch drag-to-reorder within type columns**: After rendering cards in each column, attach `enableTouchGesture()` to each `.sa-card` with drag callbacks for reordering within the column.
2. **Persist order**: Save the card order per type to localStorage (key: `cwoc_sa_order_{type}`). On render, apply the saved order before building cards.
3. **No long-press needed**: Independent alert cards have inline controls (toggle, delete, edit name) — long-press is not needed.

---

**File**: `src/frontend/js/dashboard/main-views.js`

**Function**: `displayIndicatorsView()` → `_indicatorsLoad()`

**Specific Changes**:
1. **Add drag-to-reorder for chart sections**: After rendering chart divs, attach `enableTouchGesture()` to each `div[data-ind-key]` for reordering the chart display order.
2. **Persist order**: Save the chart order to localStorage (key: `cwoc_ind_chart_order`). On render, sort charts by the saved order.
3. **Add HTML5 drag as well**: For desktop parity, add `draggable=true` and HTML5 drag events to chart sections.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate touch events on each affected view element and assert the expected behavior. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Calendar drag-then-popup test**: Simulate touchstart on a timed event, wait 400ms (drag activates), touchmove, touchend. Assert `showQuickEditModal` was NOT called. (Will fail on unfixed code because `enableLongPress` fires independently)
2. **Notes drag drop targeting test**: Simulate touch drag of a note card across columns in a masonry layout. Assert the drop target is the correct card. (Will fail on unfixed code due to `elementFromPoint` issues)
3. **Kanban header touch test**: Simulate touchstart + 400ms hold on a kanban project header. Assert drag activation occurs. (Will fail on unfixed code — no touch gesture attached)
4. **Projects list header touch test**: Simulate touchstart + 400ms hold on a list-view project header. Assert drag activation occurs. (Will fail on unfixed code — no touch gesture attached)
5. **Independent alerts drag test**: Simulate touchstart + 400ms hold on an sa-card. Assert drag activation occurs. (Will fail on unfixed code — no drag capability)
6. **Indicators drag test**: Simulate touchstart + 400ms hold on an indicator chart section. Assert drag activation occurs. (Will fail on unfixed code — no drag capability)

**Expected Counterexamples**:
- Calendar: `showQuickEditModal` is called after a completed drag gesture
- Notes: `elementFromPoint` returns the dragged card itself or null instead of the target card
- Projects/Alerts/Indicators: No touch gesture cleanup function exists on the elements (`element._touchGestureCleanup === undefined`)

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedView(input)
  IF input.view == 'Calendar' THEN
    ASSERT quickEditModal NOT shown after drag
    ASSERT quickEditModal shown after 1200ms still hold
  ELSE IF input.view == 'Notes' THEN
    ASSERT dropTarget is correct card in target column
  ELSE
    ASSERT element._touchGestureCleanup is defined
    ASSERT drag activates after 400ms hold
    ASSERT reorder persists correctly
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalView(input) = fixedView(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for all working interactions (Checklists drag, Tasks drag, Alarms drag, calendar move/resize, desktop drag, shift-click, dblclick), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Checklists drag preservation**: Verify touch drag-to-reorder on Checklists view continues to work identically after fix
2. **Tasks drag preservation**: Verify touch drag-to-reorder on Tasks view continues to work identically after fix
3. **Calendar move/resize preservation**: Verify `enableCalendarDrag` touch move and resize continue to work identically after fix
4. **Desktop HTML5 drag preservation**: Verify mouse-based drag-and-drop in all views continues to work
5. **Shift-click preservation**: Verify shift-click on calendar events still opens quick-edit
6. **Double-click preservation**: Verify double-click on any card/event still navigates to editor
7. **Kanban child card preservation**: Verify kanban child card cross-column touch drag continues to work

### Unit Tests

- Test that `attachCalendarChitEvents` no longer calls `enableLongPress`
- Test that `enableTouchGesture` is called on kanban project headers
- Test that `enableTouchGesture` is called on list-view project headers
- Test that `_displayIndependentAlertsBoard` attaches touch gesture to sa-cards
- Test that `displayIndicatorsView` attaches touch gesture to chart sections
- Test that `_onNotesDragMoveXY` sets `pointer-events: none` on dragged card before `elementFromPoint`

### Property-Based Tests

- Generate random sequences of touch events (start, move, end) on calendar events and verify quick-edit only fires on long-press without movement, never after drag
- Generate random note card positions in masonry layout and verify `elementFromPoint` returns the correct target after the pointer-events fix
- Generate random project orderings and verify touch drag reorder produces the same result as HTML5 drag reorder

### Integration Tests

- Test full calendar workflow: drag-move an event, verify no popup, then long-press (hold still 1200ms), verify popup opens
- Test full notes workflow: drag a card between columns, verify it lands in the correct position
- Test full projects kanban workflow: touch-drag a project header to reorder, verify order persists
- Test full projects list workflow: touch-drag a project header to reorder, verify order persists
- Test full independent alerts workflow: touch-drag an alarm card within the Alarms column, verify order persists
- Test full indicators workflow: touch-drag a chart section to reorder, verify order persists
