#!/usr/bin/env python3
"""
test_touch_drag_preservation.py — Preservation Property Test Runner

Static analysis test that reads the actual source code files and verifies
that existing working touch behaviors are preserved. These tests check
behaviors that ALREADY WORK in the unfixed code and must continue to work
after the bugfix is applied.

This test MUST PASS on UNFIXED code — it confirms baseline behavior to preserve.

Run with: python3 src/frontend/js/tests/test_touch_drag_preservation.py

NO npm, NO pip, NO installs required — uses only Python stdlib.

Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
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

shared_sort_src = read_source("src/frontend/js/shared/shared-sort.js")
shared_calendar_src = read_source("src/frontend/js/shared/shared-calendar.js")
shared_checklist_src = read_source("src/frontend/js/shared/shared-checklist.js")
shared_touch_src = read_source("src/frontend/js/shared/shared-touch.js")
main_calendar_src = read_source("src/frontend/js/dashboard/main-calendar.js")
main_views_src = read_source("src/frontend/js/dashboard/main-views.js")

# ── Extract relevant functions ───────────────────────────────────────────────

enable_drag_to_reorder = extract_function(shared_sort_src, "enableDragToReorder")
enable_calendar_drag = extract_function(shared_calendar_src, "enableCalendarDrag")
render_inline_checklist = extract_function(shared_checklist_src, "renderInlineChecklist")
mark_drag_just_ended = extract_function(shared_sort_src, "_markDragJustEnded")
attach_calendar_chit_events = extract_function(main_calendar_src, "attachCalendarChitEvents")
enable_touch_gesture = extract_function(shared_touch_src, "enableTouchGesture")
enable_touch_drag = extract_function(shared_touch_src, "enableTouchDrag")


# ══════════════════════════════════════════════════════════════════════════════
# PRESERVATION 1: enableDragToReorder calls enableTouchGesture
# Checklists/Tasks/Alarms chit-attached views use enableDragToReorder() from
# shared-sort.js, which internally calls enableTouchGesture() with drag+long-press
# callbacks for cards that have a long-press map entry.
# Validates: Requirements 3.1, 3.2, 3.3, 3.7
# ══════════════════════════════════════════════════════════════════════════════

describe("Preservation 1: enableDragToReorder calls enableTouchGesture (Req 3.1, 3.2, 3.3, 3.7)")

assert_true(
    enable_drag_to_reorder is not None,
    "enableDragToReorder function exists in shared-sort.js",
)

# Verify enableDragToReorder calls enableTouchGesture for cards with long-press
has_touch_gesture_call = bool(
    re.search(r"enableTouchGesture\s*\(", enable_drag_to_reorder)
)
assert_true(
    has_touch_gesture_call,
    "enableDragToReorder calls enableTouchGesture() for unified drag + long-press",
)

# Verify it also has enableTouchDrag as fallback for cards without long-press
has_touch_drag_fallback = bool(
    re.search(r"enableTouchDrag\s*\(", enable_drag_to_reorder)
)
assert_true(
    has_touch_drag_fallback,
    "enableDragToReorder falls back to enableTouchDrag() when no long-press callback",
)

# Verify it accepts a longPressMap parameter
has_long_press_map_param = bool(
    re.search(r"longPressMap", enable_drag_to_reorder)
)
assert_true(
    has_long_press_map_param,
    "enableDragToReorder accepts longPressMap parameter for per-card long-press callbacks",
)

# Verify it wires onLongPress callback through enableTouchGesture
has_on_long_press = bool(
    re.search(r"onLongPress", enable_drag_to_reorder)
)
assert_true(
    has_on_long_press,
    "enableDragToReorder passes onLongPress callback to enableTouchGesture",
)


# ══════════════════════════════════════════════════════════════════════════════
# PRESERVATION 2: enableCalendarDrag calls enableTouchDrag
# Calendar event move/resize uses enableTouchDrag() on calendar event elements.
# Validates: Requirement 3.4
# ══════════════════════════════════════════════════════════════════════════════

describe("Preservation 2: enableCalendarDrag calls enableTouchDrag (Req 3.4)")

assert_true(
    enable_calendar_drag is not None,
    "enableCalendarDrag function exists in shared-calendar.js",
)

# Verify enableCalendarDrag calls enableTouchDrag for move gesture
has_touch_drag_for_move = bool(
    re.search(r"enableTouchDrag\s*\(\s*el\b", enable_calendar_drag)
)
assert_true(
    has_touch_drag_for_move,
    "enableCalendarDrag calls enableTouchDrag(el, ...) for event move gesture",
)

# Verify enableCalendarDrag calls enableTouchDrag for resize handle
has_touch_drag_for_resize = bool(
    re.search(r"enableTouchDrag\s*\(\s*handle\b", enable_calendar_drag)
)
assert_true(
    has_touch_drag_for_resize,
    "enableCalendarDrag calls enableTouchDrag(handle, ...) for resize gesture",
)

# Verify it has both move and resize modes
has_move_mode = bool(re.search(r"mode:\s*['\"]move['\"]", enable_calendar_drag))
has_resize_mode = bool(re.search(r"mode:\s*['\"]resize['\"]", enable_calendar_drag))
assert_true(
    has_move_mode and has_resize_mode,
    "enableCalendarDrag supports both 'move' and 'resize' drag modes",
)


# ══════════════════════════════════════════════════════════════════════════════
# PRESERVATION 3: renderInlineChecklist calls enableTouchDrag
# Checklist <li> items use enableTouchDrag() for within-chit and cross-chit
# drag-to-reorder on mobile.
# Validates: Requirement 3.5
# ══════════════════════════════════════════════════════════════════════════════

describe("Preservation 3: renderInlineChecklist calls enableTouchDrag (Req 3.5)")

assert_true(
    render_inline_checklist is not None,
    "renderInlineChecklist function exists in shared-checklist.js",
)

# Verify renderInlineChecklist calls enableTouchDrag on list items
has_touch_drag_on_li = bool(
    re.search(r"enableTouchDrag\s*\(\s*li\b", render_inline_checklist)
)
assert_true(
    has_touch_drag_on_li,
    "renderInlineChecklist calls enableTouchDrag(li, ...) on checklist items",
)

# Verify it supports cross-chit moves
has_cross_chit = bool(
    re.search(r"moveChecklistItemCrossChit", render_inline_checklist)
)
assert_true(
    has_cross_chit,
    "renderInlineChecklist supports cross-chit checklist item moves",
)


# ══════════════════════════════════════════════════════════════════════════════
# PRESERVATION 4: Kanban child cards have enableTouchGesture
# Kanban child cards use enableTouchGesture() for cross-column drag + long-press.
# Validates: Requirement 3.6
# ══════════════════════════════════════════════════════════════════════════════

describe("Preservation 4: Kanban child cards have enableTouchGesture (Req 3.6)")

# Look for enableTouchGesture being called on kanban child cards in main-views.js
# The pattern is: enableTouchGesture(_card, { onDragStart: ..., onDragMove: ..., onDragEnd: ..., onLongPress: ... })
has_kanban_child_touch = bool(
    re.search(
        r"enableTouchGesture\s*\(\s*_card\s*,",
        main_views_src,
    )
)
assert_true(
    has_kanban_child_touch,
    "Kanban child cards have enableTouchGesture attached for cross-column drag",
)

# Verify the kanban touch gesture includes onLongPress for quick-edit
# The onLongPress callback is at the end of the gesture config object,
# which can be quite large due to the async drag-end handler (~3700 chars)
kanban_gesture_match = re.search(r"enableTouchGesture\s*\(\s*_card\s*,", main_views_src)
kanban_section = None
if kanban_gesture_match:
    # Check a generous window after the match for onLongPress
    start = kanban_gesture_match.start()
    chunk = main_views_src[start : start + 5000]
    if re.search(r"onLongPress", chunk):
        kanban_section = True
assert_true(
    kanban_section is not None,
    "Kanban child card enableTouchGesture includes onLongPress callback",
)


# ══════════════════════════════════════════════════════════════════════════════
# PRESERVATION 5: _markDragJustEnded sets/clears _dragJustEnded flag
# The drag suppression mechanism prevents post-drag clicks from triggering
# navigation or quick-edit.
# Validates: Requirements 3.8, 3.9, 3.10
# ══════════════════════════════════════════════════════════════════════════════

describe("Preservation 5: _markDragJustEnded sets/clears _dragJustEnded (Req 3.8, 3.9, 3.10)")

assert_true(
    mark_drag_just_ended is not None,
    "_markDragJustEnded function exists in shared-sort.js",
)

# Verify it sets window._dragJustEnded = true
sets_flag = bool(
    re.search(r"window\._dragJustEnded\s*=\s*true", mark_drag_just_ended)
)
assert_true(
    sets_flag,
    "_markDragJustEnded sets window._dragJustEnded = true",
)

# Verify it clears the flag after a timeout (300ms)
clears_flag = bool(
    re.search(r"setTimeout\s*\(", mark_drag_just_ended)
    and re.search(r"_dragJustEnded\s*=\s*false", mark_drag_just_ended)
)
assert_true(
    clears_flag,
    "_markDragJustEnded clears _dragJustEnded after 300ms timeout",
)

# Verify the 300ms delay value
has_300ms = bool(re.search(r"300\s*\)", mark_drag_just_ended))
assert_true(
    has_300ms,
    "_markDragJustEnded uses 300ms delay for clearing the flag",
)


# ══════════════════════════════════════════════════════════════════════════════
# PRESERVATION 6: enableDragToReorder wires HTML5 drag events on container
# Desktop HTML5 drag-and-drop (dragstart, dragover, drop, dragend) is wired
# on chit cards in enableDragToReorder().
# Validates: Requirement 3.8
# ══════════════════════════════════════════════════════════════════════════════

describe("Preservation 6: enableDragToReorder wires HTML5 drag events (Req 3.8)")

# Verify dragstart event listener
has_dragstart = bool(
    re.search(r"addEventListener\s*\(\s*['\"]dragstart['\"]", enable_drag_to_reorder)
)
assert_true(
    has_dragstart,
    "enableDragToReorder wires 'dragstart' event listener on container",
)

# Verify dragend event listener
has_dragend = bool(
    re.search(r"addEventListener\s*\(\s*['\"]dragend['\"]", enable_drag_to_reorder)
)
assert_true(
    has_dragend,
    "enableDragToReorder wires 'dragend' event listener on container",
)

# Verify dragover event listener
has_dragover = bool(
    re.search(r"addEventListener\s*\(\s*['\"]dragover['\"]", enable_drag_to_reorder)
)
assert_true(
    has_dragover,
    "enableDragToReorder wires 'dragover' event listener on container",
)

# Verify drop event listener
has_drop = bool(
    re.search(r"addEventListener\s*\(\s*['\"]drop['\"]", enable_drag_to_reorder)
)
assert_true(
    has_drop,
    "enableDragToReorder wires 'drop' event listener on container",
)


# ══════════════════════════════════════════════════════════════════════════════
# PRESERVATION 7: attachCalendarChitEvents wires shift-click and dblclick
# Desktop interactions: shift-click opens quick-edit modal, dblclick navigates
# to the editor page.
# Validates: Requirements 3.9, 3.10
# ══════════════════════════════════════════════════════════════════════════════

describe("Preservation 7: attachCalendarChitEvents wires shift-click and dblclick (Req 3.9, 3.10)")

assert_true(
    attach_calendar_chit_events is not None,
    "attachCalendarChitEvents function exists in main-calendar.js",
)

# Verify dblclick event listener for editor navigation
has_dblclick = bool(
    re.search(r"addEventListener\s*\(\s*['\"]dblclick['\"]", attach_calendar_chit_events)
)
assert_true(
    has_dblclick,
    "attachCalendarChitEvents wires 'dblclick' event for editor navigation",
)

# Verify click event listener (for shift-click quick-edit)
has_click = bool(
    re.search(r"addEventListener\s*\(\s*['\"]click['\"]", attach_calendar_chit_events)
)
assert_true(
    has_click,
    "attachCalendarChitEvents wires 'click' event for shift-click quick-edit",
)

# Verify shift key check in click handler
has_shift_check = bool(
    re.search(r"e\.shiftKey", attach_calendar_chit_events)
)
assert_true(
    has_shift_check,
    "attachCalendarChitEvents checks e.shiftKey for shift-click quick-edit",
)

# Verify showQuickEditModal is called for shift-click
has_quick_edit = bool(
    re.search(r"showQuickEditModal\s*\(", attach_calendar_chit_events)
)
assert_true(
    has_quick_edit,
    "attachCalendarChitEvents calls showQuickEditModal for shift-click quick-edit",
)

# Verify openChitForEdit is called for dblclick
has_open_edit = bool(
    re.search(r"openChitForEdit\s*\(", attach_calendar_chit_events)
)
assert_true(
    has_open_edit,
    "attachCalendarChitEvents calls openChitForEdit for dblclick navigation",
)


# ── Summary ──────────────────────────────────────────────────────────────────

print("\n" + "═" * 70)
print(f"Results: {_passed} passed, {_failed} failed")

if _failures:
    print("\nFailed assertions (regressions detected):")
    for i, f in enumerate(_failures, 1):
        print(f"  {i}. {f}")

print("═" * 70)

# Exit with non-zero code if any assertions failed
if _failed > 0:
    print(f"\nTest FAILED — {_failed} preservation check(s) failed.")
    print("This indicates a regression in existing working behavior.")
    sys.exit(1)
else:
    print("\nAll preservation checks PASSED — baseline behavior confirmed.")
    print("These behaviors must remain unchanged after the bugfix.")
    sys.exit(0)
