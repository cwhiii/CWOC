/**
 * test_touch_drag_bugs.js — Bug Condition Exploration Test
 *
 * Static analysis test that reads the actual source code files and verifies
 * that the six mobile touch drag defects exist in the UNFIXED code.
 *
 * This test is EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 * Each assertion checks for the presence of a known defect condition.
 *
 * Run with: python3 src/frontend/js/tests/run_touch_drag_bugs.py
 *
 * The test logic is defined here as documentation; the actual runner is the
 * companion Python script that performs the same static analysis checks.
 *
 * NO npm, NO pip, NO installs required.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * ── Six Defects ──────────────────────────────────────────────────────────────
 *
 * Defect 1 (Calendar): enableLongPress() is called in attachCalendarChitEvents()
 *   independently from enableTouchDrag(), creating a race condition where the
 *   long-press timer fires after a drag completes.
 *
 * Defect 2 (Notes): pointer-events is not set to 'none' before elementFromPoint()
 *   in _onNotesDragMoveXY(), so the dragged card (floating under the finger)
 *   is returned instead of the actual drop target.
 *
 * Defect 3 (Projects kanban headers): _displayProjectsKanban() only wires HTML5
 *   drag events on project headers, no enableTouchGesture() — touch drag doesn't
 *   work on mobile.
 *
 * Defect 4 (Projects list): displayProjectsView() list mode has no touch gesture
 *   for project header elements — no project-level reordering on mobile.
 *
 * Defect 5 (Independent alerts): _displayIndependentAlertsBoard() has no drag
 *   setup at all — cards cannot be reordered.
 *
 * Defect 6 (Indicators): displayIndicatorsView()/_indicatorsLoad() have no
 *   drag-to-reorder setup — chart sections cannot be reordered.
 */
