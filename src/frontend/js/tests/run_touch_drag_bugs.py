#!/usr/bin/env python3
"""
run_touch_drag_bugs.py — Bug Condition Exploration Test Runner

Static analysis test that reads the actual source code files and verifies
that the six mobile touch drag defects exist in the UNFIXED code.

This test is EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
Each assertion checks for the presence of a known defect condition.

Run with: python3 src/frontend/js/tests/run_touch_drag_bugs.py

NO npm, NO pip, NO installs required — uses only Python stdlib.

Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
"""

import os
import re
import sys

# ── Minimal test harness ─────────────────────────────────────────────────────

_passed = 0
_failed = 0
_failures = []


def assert_true(condition, message):
    global _passed, _failed
    if condition:
        _passed += 1
        print(f"  ✓ {message}")
    else:
        _failed += 1
        _failures.append(message)
        print(f"  ✗ FAIL: {message}")


def describe(name):
    print(f"\n{name}")


# ── File reading helpers ─────────────────────────────────────────────────────

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))


def read_source(rel_path):
    full_path = os.path.join(ROOT, rel_path)
    if not os.path.exists(full_path):
        raise FileNotFoundError(f"Source file not found: {full_path}")
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def extract_function(source, func_name):
    """
    Extract a function body from JS source code by name.
    Finds 'function <name>(' or 'async function <name>(' and returns
    everything from that line through the matching closing brace.
    """
    pattern = re.compile(r"(async\s+)?function\s+" + re.escape(func_name) + r"\s*\(")
    match = pattern.search(source)
    if not match:
        return None

    start_idx = match.start()

    # Find the opening brace
    brace_idx = source.index("{", start_idx)

    # Walk forward to find the matching close brace
    depth = 0
    i = brace_idx
    while i < len(source):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1

    return source[start_idx : i + 1]


# ── Load source files ────────────────────────────────────────────────────────

main_calendar_src = read_source("src/frontend/js/dashboard/main-calendar.js")
shared_src = read_source("src/frontend/js/shared/shared.js")
main_views_src = read_source("src/frontend/js/dashboard/main-views.js")
shared_touch_src = read_source("src/frontend/js/shared/shared-touch.js")
shared_sort_src = read_source("src/frontend/js/shared/shared-sort.js")

# ── Extract relevant functions ───────────────────────────────────────────────

attach_calendar_chit_events = extract_function(main_calendar_src, "attachCalendarChitEvents")
on_notes_drag_move_xy = extract_function(shared_src, "_onNotesDragMoveXY")
display_projects_kanban = extract_function(main_views_src, "_displayProjectsKanban")
display_projects_view = extract_function(main_views_src, "displayProjectsView")
display_independent_alerts_board = extract_function(main_views_src, "_displayIndependentAlertsBoard")
display_indicators_view = extract_function(main_views_src, "displayIndicatorsView")
indicators_load = extract_function(main_views_src, "_indicatorsLoad")

# ══════════════════════════════════════════════════════════════════════════════
# DEFECT 1: Calendar — enableLongPress called independently from enableTouchDrag
# Bug: attachCalendarChitEvents() calls enableLongPress() which runs its own
#      touch listeners independently from the drag system, causing a race
#      condition where the long-press timer fires after a drag completes.
# Validates: Requirement 1.1
# ══════════════════════════════════════════════════════════════════════════════

describe("Defect 1: Calendar enableLongPress race condition")

assert_true(
    attach_calendar_chit_events is not None,
    "attachCalendarChitEvents function exists in main-calendar.js",
)

# The bug: enableLongPress is called inside attachCalendarChitEvents
has_enable_long_press = bool(re.search(r"enableLongPress\s*\(", attach_calendar_chit_events))
assert_true(
    not has_enable_long_press,
    "attachCalendarChitEvents should NOT call enableLongPress() independently "
    "(found: enableLongPress IS called — this is the bug)",
)

# Verify enableLongPress is a standalone function (not coordinated with drag)
enable_long_press_fn = extract_function(shared_src, "enableLongPress")
assert_true(
    enable_long_press_fn is None,
    "enableLongPress should not exist as a standalone function "
    "(found: it DOES exist — deprecated function still present)",
)

# ══════════════════════════════════════════════════════════════════════════════
# DEFECT 2: Notes — pointer-events not set before elementFromPoint
# Bug: _onNotesDragMoveXY() does not set pointer-events: none on the dragged
#      card before calling elementFromPoint(), so the dragged card (floating
#      under the finger with absolute positioning) is returned instead of the
#      actual drop target.
# Validates: Requirement 1.2
# ══════════════════════════════════════════════════════════════════════════════

describe("Defect 2: Notes drag targeting (pointer-events)")

assert_true(
    on_notes_drag_move_xy is not None,
    "_onNotesDragMoveXY function exists in shared.js",
)

# The bug: pointer-events is never set to 'none' before elementFromPoint
sets_pointer_events_none = bool(
    re.search(r"pointer-events\s*[=:]\s*['\"]none['\"]", on_notes_drag_move_xy)
    or re.search(r"pointerEvents\s*=\s*['\"]none['\"]", on_notes_drag_move_xy)
)
assert_true(
    sets_pointer_events_none,
    "_onNotesDragMoveXY should set pointer-events: none on dragged card before elementFromPoint "
    "(found: pointer-events is NOT set — this is the bug)",
)

# ══════════════════════════════════════════════════════════════════════════════
# DEFECT 3: Projects kanban headers — no enableTouchGesture
# Bug: _displayProjectsKanban() only wires HTML5 drag events on project headers
#      (.kanban-project-header), but does not call enableTouchGesture() on them.
#      Touch drag does not work on mobile for project-level reordering.
# Validates: Requirement 1.3
# ══════════════════════════════════════════════════════════════════════════════

describe("Defect 3: Projects kanban headers missing touch gesture")

assert_true(
    display_projects_kanban is not None,
    "_displayProjectsKanban function exists in main-views.js",
)

# Check if enableTouchGesture is called on kanban-project-header elements
# The function should query .kanban-project-header and attach touch gesture
queries_headers = bool(
    re.search(r"querySelectorAll\s*\(\s*['\"]\.kanban-project-header['\"]\s*\)", display_projects_kanban)
)
has_header_touch_gesture = bool(
    re.search(r"kanban-project-header[\s\S]{0,500}enableTouchGesture", display_projects_kanban)
    or re.search(r"enableTouchGesture[\s\S]{0,500}kanban-project-header", display_projects_kanban)
)
header_has_touch_setup = queries_headers and has_header_touch_gesture

assert_true(
    header_has_touch_setup,
    "_displayProjectsKanban should call enableTouchGesture on .kanban-project-header elements "
    "(found: no touch gesture on project headers — this is the bug)",
)

# ══════════════════════════════════════════════════════════════════════════════
# DEFECT 4: Projects list view — no enableTouchGesture on project headers
# Bug: displayProjectsView() in list mode does not call enableTouchGesture()
#      on project header elements. Project-level reordering has no touch support.
# Validates: Requirement 1.4
# ══════════════════════════════════════════════════════════════════════════════

describe("Defect 4: Projects list view missing touch gesture on headers")

assert_true(
    display_projects_view is not None,
    "displayProjectsView function exists in main-views.js",
)

# The list mode section should attach enableTouchGesture to project header elements.
# Currently it only has enableTouchGesture for child items (.projects-child-item),
# but NOT for the project header elements themselves.

# Check if there's project-level reorder touch gesture on the header/box elements.
# We need to be specific: the existing enableTouchGesture calls in displayProjectsView
# are ONLY for child items (.projects-child-item). We need to check if there's a
# SEPARATE enableTouchGesture call for project header/box elements.

# Count enableTouchGesture calls — if there's only one block (for child items),
# then project headers have no touch gesture
touch_gesture_calls = re.findall(r"enableTouchGesture\s*\(", display_projects_view)

# Check if any enableTouchGesture call is associated with the project box/header
# (not the child items). The child item touch gesture is inside a forEach on
# '.projects-child-item' elements. A project header touch gesture would be on
# the header or box element directly.
has_project_box_touch = bool(
    re.search(r"box[\s\S]{0,100}enableTouchGesture", display_projects_view)
    or re.search(r"enableTouchGesture\s*\(\s*box", display_projects_view)
    or re.search(r"enableTouchGesture\s*\(\s*header", display_projects_view)
)

# Also check for project-level drag reorder via enableDragToReorder on the view
has_project_reorder = bool(
    re.search(r"enableDragToReorder\s*\(\s*view", display_projects_view)
)

assert_true(
    has_project_box_touch or has_project_reorder,
    "displayProjectsView (list mode) should call enableTouchGesture on project header elements "
    "(found: no touch gesture on project headers — this is the bug)",
)

# ══════════════════════════════════════════════════════════════════════════════
# DEFECT 5: Independent alerts — no drag setup at all
# Bug: _displayIndependentAlertsBoard() renders .sa-card elements but does not
#      call enableTouchGesture(), enableDragToReorder(), or any drag setup.
#      Cards cannot be reordered at all on mobile or desktop.
# Validates: Requirement 1.5
# ══════════════════════════════════════════════════════════════════════════════

describe("Defect 5: Independent alerts missing drag capability")

assert_true(
    display_independent_alerts_board is not None,
    "_displayIndependentAlertsBoard function exists in main-views.js",
)

# Check for ANY drag setup in the function
has_touch_gesture = bool(re.search(r"enableTouchGesture\s*\(", display_independent_alerts_board))
has_drag_to_reorder = bool(re.search(r"enableDragToReorder\s*\(", display_independent_alerts_board))
has_draggable = bool(re.search(r"draggable\s*=\s*true", display_independent_alerts_board))
has_dragstart = bool(re.search(r"dragstart", display_independent_alerts_board))

has_any_drag_setup = has_touch_gesture or has_drag_to_reorder or has_draggable or has_dragstart

assert_true(
    has_any_drag_setup,
    "_displayIndependentAlertsBoard should have drag-to-reorder setup for .sa-card elements "
    "(found: NO drag capability at all — this is the bug)",
)

# ══════════════════════════════════════════════════════════════════════════════
# DEFECT 6: Indicators — no drag-to-reorder setup
# Bug: displayIndicatorsView() and _indicatorsLoad() render div[data-ind-key]
#      chart sections but do not call enableTouchGesture(), enableDragToReorder(),
#      or any drag setup. Charts cannot be reordered.
# Validates: Requirement 1.6
# ══════════════════════════════════════════════════════════════════════════════

describe("Defect 6: Indicators view missing drag capability")

assert_true(
    display_indicators_view is not None,
    "displayIndicatorsView function exists in main-views.js",
)
assert_true(
    indicators_load is not None,
    "_indicatorsLoad function exists in main-views.js",
)

# Check both functions for any drag setup
combined_src = (display_indicators_view or "") + (indicators_load or "")

has_touch_gesture = bool(re.search(r"enableTouchGesture\s*\(", combined_src))
has_drag_to_reorder = bool(re.search(r"enableDragToReorder\s*\(", combined_src))
has_draggable = bool(re.search(r"draggable\s*=\s*true", combined_src))
has_dragstart = bool(re.search(r"addEventListener\s*\(\s*['\"]dragstart['\"]", combined_src))

has_any_drag_setup = has_touch_gesture or has_drag_to_reorder or has_draggable or has_dragstart

assert_true(
    has_any_drag_setup,
    "displayIndicatorsView/_indicatorsLoad should have drag-to-reorder setup for "
    "div[data-ind-key] elements (found: NO drag capability at all — this is the bug)",
)

# ── Summary ──────────────────────────────────────────────────────────────────

print("\n" + "═" * 70)
print(f"Results: {_passed} passed, {_failed} failed")

if _failures:
    print("\nCounterexamples (defects confirmed):")
    for i, f in enumerate(_failures, 1):
        print(f"  {i}. {f}")

print("═" * 70)

# Exit with non-zero code if any assertions failed
if _failed > 0:
    print(f"\nTest FAILED — {_failed} defect(s) confirmed to exist in unfixed code.")
    print("This is the EXPECTED outcome for bug condition exploration.")
    sys.exit(1)
else:
    print("\nAll assertions passed — bugs may have been fixed already.")
    sys.exit(0)
