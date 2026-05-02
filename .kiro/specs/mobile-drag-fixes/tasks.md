# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Mobile Touch Drag Defects Across Six Views
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the six defects exist
  - **Scoped PBT Approach**: For each defect, scope the property to the concrete failing case(s):
    - Defect 1 (Calendar): Simulate touchstart on a `.timed-event` element, wait 400ms (drag activates), touchmove, touchend. Assert `showQuickEditModal` was NOT called. Bug condition: `attachCalendarChitEvents()` calls `enableLongPress()` independently from `enableTouchDrag()`, so the long-press timer fires after drag completes.
    - Defect 2 (Notes): Simulate touch drag of a note card in masonry layout. Assert `elementFromPoint()` returns the correct target card, not the dragged card itself. Bug condition: `_onNotesDragMoveXY()` does not set `pointer-events: none` on the dragged card before calling `elementFromPoint()`.
    - Defect 3 (Projects kanban headers): Assert that `.kanban-project-header` elements have `_touchGestureCleanup` defined (i.e., `enableTouchGesture()` is attached). Bug condition: `_displayProjectsKanban()` only wires HTML5 drag events, no touch gesture.
    - Defect 4 (Projects list): Assert that project header elements and `.projects-child-item` elements in list view have `_touchGestureCleanup` defined. Bug condition: `displayProjectsView()` list mode has no touch gesture for project headers.
    - Defect 5 (Independent alerts): Assert that `.sa-card` elements have `_touchGestureCleanup` defined. Bug condition: `_displayIndependentAlertsBoard()` has no drag setup at all.
    - Defect 6 (Indicators): Assert that indicator chart section elements (`div[data-ind-key]`) have `_touchGestureCleanup` defined. Bug condition: `displayIndicatorsView()` has no drag-to-reorder setup.
  - Write a test file `src/frontend/js/tests/test_touch_drag_bugs.js` that programmatically checks each condition
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found:
    - Calendar: `enableLongPress` is called in `attachCalendarChitEvents` (confirmed by grep)
    - Notes: `pointer-events` is not set to `none` before `elementFromPoint` in `_onNotesDragMoveXY`
    - Projects kanban/list, Alerts, Indicators: `_touchGestureCleanup` is undefined on target elements
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Working Touch Behaviors Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (all working views):
    - Observe: `enableDragToReorder()` in `shared-sort.js` calls `enableTouchGesture()` with drag+long-press callbacks for Checklists/Tasks/Alarms chit-attached views — cards have `_touchGestureCleanup` defined
    - Observe: `enableCalendarDrag()` in `shared-calendar.js` calls `enableTouchDrag()` on calendar event elements for move/resize — elements have `_touchDragCleanup` defined
    - Observe: `renderInlineChecklist()` in `shared-checklist.js` calls `enableTouchDrag()` on checklist `<li>` items — items have `_touchDragCleanup` defined
    - Observe: Kanban child cards have `enableTouchGesture()` attached for cross-column drag
    - Observe: `_markDragJustEnded()` sets `window._dragJustEnded = true` and clears after 300ms, suppressing post-drag clicks
    - Observe: Desktop HTML5 drag events (`dragstart`, `dragover`, `drop`, `dragend`) are wired on chit cards in `enableDragToReorder()`
    - Observe: `attachCalendarChitEvents()` wires shift-click for quick-edit and dblclick for editor navigation
  - Write property-based test in `src/frontend/js/tests/test_touch_drag_preservation.js`:
    - For all `.chit-card` elements in Checklists/Tasks/Alarms views: assert `_touchGestureCleanup` or `_touchDragCleanup` is a function (touch gesture attached)
    - For all calendar event elements processed by `enableCalendarDrag`: assert `_touchDragCleanup` is a function
    - For all checklist `<li>` items: assert `_touchDragCleanup` is a function
    - Assert `_markDragJustEnded` function exists and sets/clears `_dragJustEnded` flag correctly
    - Assert `enableDragToReorder` wires HTML5 drag events on container
    - Assert `attachCalendarChitEvents` wires shift-click and dblclick handlers
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 3. Fix for Defect 1 — Calendar quick-edit after drag

  - [x] 3.1 Replace `enableLongPress()` with unified gesture in calendar events
    - In `src/frontend/js/dashboard/main-calendar.js`, function `attachCalendarChitEvents()`:
      - Remove the `if (typeof enableLongPress === 'function')` block that independently attaches long-press
      - Do NOT add `enableTouchGesture()` here — instead, pass the quick-edit callback through to `enableCalendarDrag()` so it can use `enableTouchGesture()` instead of `enableTouchDrag()` for the move gesture
    - In `src/frontend/js/shared/shared-calendar.js`, function `enableCalendarDrag()`:
      - Accept an optional `longPressMap` parameter (map of element → long-press callback)
      - When a long-press callback exists for an element, use `enableTouchGesture()` instead of `enableTouchDrag()` for the move gesture, passing both drag and long-press callbacks
      - This keeps gesture coordination in one place per element, preventing the race condition
    - _Bug_Condition: isBugCondition(input) where input.view == 'Calendar' AND element has enableLongPress() attached independently from enableTouchDrag()_
    - _Expected_Behavior: Quick-edit modal NOT shown after drag; only shown after 1200ms still hold with no movement_
    - _Preservation: Calendar drag-move and drag-resize via enableTouchDrag() in enableCalendarDrag() continues to work; shift-click quick-edit on desktop unchanged; dblclick navigation unchanged_
    - _Requirements: 1.1, 2.1, 3.4, 3.9, 3.10_

  - [x] 3.2 Verify bug condition exploration test now passes for Defect 1
    - **Property 1: Expected Behavior** - Calendar Drag Does Not Trigger Quick-Edit
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The Defect 1 portion of the test from task 1 encodes the expected behavior
    - When this test passes, it confirms `enableLongPress` is no longer called independently
    - Run bug condition exploration test from step 1 (Defect 1 assertions only)
    - **EXPECTED OUTCOME**: Test PASSES (confirms Defect 1 is fixed)
    - _Requirements: 2.1_

  - [x] 3.3 Verify preservation tests still pass for calendar
    - **Property 2: Preservation** - Calendar Move/Resize and Desktop Interactions
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm calendar drag-move, drag-resize, shift-click, and dblclick still work

- [x] 4. Fix for Defect 2 — Notes drag targeting

  - [x] 4.1 Fix `elementFromPoint` in `_onNotesDragMoveXY()`
    - In `src/frontend/js/shared/shared.js`, function `_onNotesDragMoveXY()`:
      - Before calling `elementFromPoint()`, set `pointer-events: none` on the dragged card element
      - Call `elementFromPoint()` to find the correct drop target
      - Immediately restore `pointer-events` on the dragged card (set back to `''` or `auto`)
      - This prevents `elementFromPoint` from returning the dragged card itself when it's floating under the finger in the absolute-positioned masonry layout
    - _Bug_Condition: isBugCondition(input) where input.view == 'Notes' AND container uses absolute positioning AND elementFromPoint returns wrong target_
    - _Expected_Behavior: elementFromPoint returns the correct target card in the target column, not the dragged card_
    - _Preservation: Notes masonry layout rendering unchanged; enableTouchGesture() attachment on note cards unchanged_
    - _Requirements: 1.2, 2.2_

  - [x] 4.2 Verify bug condition exploration test now passes for Defect 2
    - **Property 1: Expected Behavior** - Notes Drag Targets Correctly
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run bug condition exploration test from step 1 (Defect 2 assertions only)
    - **EXPECTED OUTCOME**: Test PASSES (confirms Defect 2 is fixed)
    - _Requirements: 2.2_

  - [x] 4.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behaviors Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 5. Fix for Defect 3 — Projects kanban header drag

  - [x] 5.1 Add `enableTouchGesture()` to kanban project headers
    - In `src/frontend/js/dashboard/main-views.js`, function `_displayProjectsKanban()`:
      - After rendering all project boxes, iterate over `.kanban-project-header` elements
      - Attach `enableTouchGesture()` with drag callbacks that mirror the HTML5 project-level reorder logic:
        - `onDragStart`: record the dragged project header, add visual feedback
        - `onDragMove`: find target project header via `elementFromPoint`, show drop indicator
        - `onDragEnd`: reorder project boxes in DOM, save manual order, refresh view
      - `onLongPress`: open the project chit in the editor (same as dblclick behavior)
    - _Bug_Condition: isBugCondition(input) where input.view == 'Projects' AND projectsViewMode == 'kanban' AND element._touchGestureCleanup is undefined_
    - _Expected_Behavior: element._touchGestureCleanup is defined; drag activates after 400ms hold; reorder persists correctly_
    - _Preservation: HTML5 drag on project headers for desktop unchanged; kanban child card cross-column drag unchanged_
    - _Requirements: 1.3, 2.3, 3.6, 3.8_

  - [x] 5.2 Verify bug condition exploration test now passes for Defect 3
    - **Property 1: Expected Behavior** - Kanban Headers Are Touch-Draggable
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run bug condition exploration test from step 1 (Defect 3 assertions only)
    - **EXPECTED OUTCOME**: Test PASSES (confirms Defect 3 is fixed)
    - _Requirements: 2.3_

  - [x] 5.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behaviors Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 6. Fix for Defect 4 — Projects list view drag

  - [x] 6.1 Add `enableTouchGesture()` to project headers and child items in list view
    - In `src/frontend/js/dashboard/main-views.js`, function `displayProjectsView()` (list mode):
      - Add project-level reorder: attach `enableTouchGesture()` to project header elements with drag callbacks for reordering projects
      - Also add HTML5 drag events to project headers for desktop parity
      - `onDragStart`/`onDragMove`/`onDragEnd`: mirror the kanban project reorder pattern adapted for list layout
      - `onLongPress` on project headers: open quick-edit modal for the project chit
      - Verify existing `enableTouchGesture()` on child items (`.projects-child-item`) has long-press for quick-edit
    - _Bug_Condition: isBugCondition(input) where input.view == 'Projects' AND projectsViewMode == 'list' AND element._touchGestureCleanup is undefined_
    - _Expected_Behavior: element._touchGestureCleanup is defined on both project headers and child items; drag activates after 400ms hold_
    - _Preservation: Existing child item HTML5 drag unchanged; desktop interactions unchanged_
    - _Requirements: 1.4, 2.4, 3.8_

  - [x] 6.2 Verify bug condition exploration test now passes for Defect 4
    - **Property 1: Expected Behavior** - List View Elements Are Touch-Draggable
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run bug condition exploration test from step 1 (Defect 4 assertions only)
    - **EXPECTED OUTCOME**: Test PASSES (confirms Defect 4 is fixed)
    - _Requirements: 2.4_

  - [x] 6.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behaviors Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 7. Fix for Defect 5 — Independent alerts drag

  - [x] 7.1 Add touch drag-to-reorder for standalone alert cards
    - In `src/frontend/js/dashboard/main-views.js`, function `_displayIndependentAlertsBoard()`:
      - After rendering cards in each type column (Alarms, Timers, Stopwatches), attach `enableTouchGesture()` to each `.sa-card` with drag callbacks for reordering within the column
      - `onDragStart`: record dragged card, add visual feedback class
      - `onDragMove`: find target `.sa-card` via `elementFromPoint`, show drop indicator border
      - `onDragEnd`: reorder cards in DOM, save order to localStorage (key: `cwoc_sa_order_{type}`)
      - Also add HTML5 drag events for desktop parity
      - On render, read saved order from localStorage and apply before building cards
      - No long-press needed — independent alert cards have inline controls
    - _Bug_Condition: isBugCondition(input) where input.view == 'Alarms' AND alarmsViewMode == 'independent' AND input.element matches '.sa-card'_
    - _Expected_Behavior: element._touchGestureCleanup is defined; drag-to-reorder works within each type column; order persists to localStorage_
    - _Preservation: Chit-attached alarms view drag unchanged; independent alert inline controls (toggle, delete, edit) unchanged_
    - _Requirements: 1.5, 2.5, 3.3_

  - [x] 7.2 Verify bug condition exploration test now passes for Defect 5
    - **Property 1: Expected Behavior** - Alert Cards Support Touch Drag
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run bug condition exploration test from step 1 (Defect 5 assertions only)
    - **EXPECTED OUTCOME**: Test PASSES (confirms Defect 5 is fixed)
    - _Requirements: 2.5_

  - [x] 7.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behaviors Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 8. Fix for Defect 6 — Indicators drag

  - [x] 8.1 Add `enableDragToReorder()` or `enableTouchGesture()` to indicator chart sections
    - In `src/frontend/js/dashboard/main-views.js`, function `displayIndicatorsView()` / `_indicatorsLoad()`:
      - After rendering chart divs (`div[data-ind-key]`), attach `enableTouchGesture()` to each chart section for reordering
      - `onDragStart`/`onDragMove`/`onDragEnd`: reorder chart sections in DOM, save order to localStorage (key: `cwoc_ind_chart_order`)
      - Also add HTML5 drag events (`draggable=true`, `dragstart`, `dragover`, `drop`) for desktop parity
      - On render, read saved order from localStorage and sort charts accordingly
      - `onLongPress`: open quick-edit modal for the indicator's chit (if applicable)
    - _Bug_Condition: isBugCondition(input) where input.view == 'Indicators' AND input.element matches indicator chart section AND element._touchGestureCleanup is undefined_
    - _Expected_Behavior: element._touchGestureCleanup is defined; drag-to-reorder works; order persists to localStorage_
    - _Preservation: Indicator chart rendering and data display unchanged_
    - _Requirements: 1.6, 2.6_

  - [x] 8.2 Verify bug condition exploration test now passes for Defect 6
    - **Property 1: Expected Behavior** - Indicator Charts Support Touch Drag
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run bug condition exploration test from step 1 (Defect 6 assertions only)
    - **EXPECTED OUTCOME**: Test PASSES (confirms Defect 6 is fixed)
    - _Requirements: 2.6_

  - [x] 8.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behaviors Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 9. Update INDEX.md
  - Update `src/INDEX.md` with any new or changed function signatures
  - Document new parameters added to `enableCalendarDrag()` (longPressMap)
  - Document any new helper functions added for project header drag, alert card drag, or indicator drag
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 10. Update VERSION and release notes
  - Run `date "+%Y%m%d.%H%M"` to get the current timestamp
  - Update `src/VERSION` with the new version number
  - Create release notes file `documents/release_notes/cwoc_release_{version}.md` with a brief summary of the six mobile touch drag fixes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify bug condition exploration tests (task 1) all PASS on fixed code
  - Verify preservation tests (task 2) all PASS on fixed code
  - Confirm no regressions in any view
