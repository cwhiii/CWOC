#!/usr/bin/env python3
"""
Unit tests for enableTouchDrag() touch event adapter (Task 5.4).

Since we cannot execute JS in Python, these tests verify that shared.js
contains the expected function definition, logic patterns, and integration
points introduced by Tasks 5.1, 5.2, and 5.3.

Validates: Requirements 9.1, 9.5

Run:  python frontend/tests/test_touch_drag.py
"""

import os
import re
import sys

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..")

passed = 0
failed = 0


def check(description, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ PASS: {description}")
        passed += 1
    else:
        msg = f"  ❌ FAIL: {description}"
        if detail:
            msg += f" — {detail}"
        print(msg)
        failed += 1


def _read(filename):
    """Read a file from the frontend directory."""
    path = os.path.join(FRONTEND_DIR, filename)
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def test_enableTouchDrag_definition():
    """Verify shared.js defines the enableTouchDrag function."""
    print("\n── enableTouchDrag definition (Req 9.1) ──")
    content = _read("shared.js")
    check("shared.js exists", content is not None, "file not found")
    if content is None:
        return
    has_fn = bool(re.search(
        r"function\s+enableTouchDrag\s*\(\s*element\s*,\s*callbacks\s*\)",
        content,
    ))
    check(
        "shared.js defines enableTouchDrag(element, callbacks)",
        has_fn,
        "function definition not found",
    )


def test_touch_coordinate_extraction():
    """Verify the function extracts clientX/clientY from touch events."""
    print("\n── Touch coordinate extraction (Req 9.1) ──")
    content = _read("shared.js")
    if content is None:
        return
    has_clientX = bool(re.search(r"touch\.clientX", content))
    has_clientY = bool(re.search(r"touch\.clientY", content))
    check(
        "shared.js extracts touch.clientX",
        has_clientX,
        "touch.clientX not found",
    )
    check(
        "shared.js extracts touch.clientY",
        has_clientY,
        "touch.clientY not found",
    )


def test_preventDefault_on_touchmove():
    """Verify preventDefault() is called on touchmove to block scroll during drag."""
    print("\n── preventDefault on touchmove (Req 9.5) ──")
    content = _read("shared.js")
    if content is None:
        return
    # Find the _onTouchMove handler and check it calls preventDefault
    match = re.search(
        r"function\s+_onTouchMove\s*\(\s*e\s*\)\s*\{(.*?)\}",
        content,
        re.DOTALL,
    )
    check(
        "shared.js defines _onTouchMove handler",
        match is not None,
        "_onTouchMove function not found",
    )
    if match is None:
        return
    body = match.group(1)
    has_prevent = "preventDefault" in body
    check(
        "_onTouchMove calls preventDefault()",
        has_prevent,
        "preventDefault() not found in _onTouchMove body",
    )


def test_try_catch_noop_fallback():
    """Verify enableTouchDrag wraps logic in try/catch for no-op fallback."""
    print("\n── try/catch no-op fallback (Req 9.1) ──")
    content = _read("shared.js")
    if content is None:
        return
    # Find the enableTouchDrag function and check for try/catch
    fn_match = re.search(
        r"function\s+enableTouchDrag\s*\(", content
    )
    if fn_match is None:
        check("enableTouchDrag found for try/catch check", False)
        return
    fn_chunk = content[fn_match.start():fn_match.start() + 2000]
    has_try = "try {" in fn_chunk or "try{" in fn_chunk
    has_catch = bool(re.search(r"catch\s*\(", fn_chunk))
    check(
        "enableTouchDrag contains try block",
        has_try,
        "try { not found in function body",
    )
    check(
        "enableTouchDrag contains catch block",
        has_catch,
        "catch() not found in function body",
    )


def test_callback_support():
    """Verify enableTouchDrag supports onStart, onMove, onEnd callbacks."""
    print("\n── onStart/onMove/onEnd callback support (Req 9.1) ──")
    content = _read("shared.js")
    if content is None:
        return
    fn_match = re.search(
        r"function\s+enableTouchDrag\s*\(", content
    )
    if fn_match is None:
        check("enableTouchDrag found for callback check", False)
        return
    fn_chunk = content[fn_match.start():fn_match.start() + 2000]
    for cb_name in ("onStart", "onMove", "onEnd"):
        has_cb = bool(re.search(
            rf"callbacks\.{cb_name}\b", fn_chunk
        ))
        check(
            f"enableTouchDrag references callbacks.{cb_name}",
            has_cb,
            f"callbacks.{cb_name} not found in function body",
        )


def test_enableCalendarDrag_calls_enableTouchDrag():
    """Verify enableCalendarDrag integrates enableTouchDrag (Task 5.2)."""
    print("\n── enableCalendarDrag → enableTouchDrag integration (Req 9.1) ──")
    content = _read("shared.js")
    if content is None:
        return
    fn_match = re.search(
        r"function\s+enableCalendarDrag\s*\(", content
    )
    check(
        "shared.js defines enableCalendarDrag()",
        fn_match is not None,
        "function definition not found",
    )
    if fn_match is None:
        return
    # Search a generous chunk after the function start
    fn_chunk = content[fn_match.start():fn_match.start() + 5000]
    has_call = "enableTouchDrag" in fn_chunk
    check(
        "enableCalendarDrag() calls enableTouchDrag()",
        has_call,
        "enableTouchDrag not found in enableCalendarDrag body",
    )


def test_renderInlineChecklist_calls_enableTouchDrag():
    """Verify renderInlineChecklist integrates enableTouchDrag (Task 5.3)."""
    print("\n── renderInlineChecklist → enableTouchDrag integration (Req 9.3) ──")
    content = _read("shared.js")
    if content is None:
        return
    fn_match = re.search(
        r"function\s+renderInlineChecklist\s*\(", content
    )
    check(
        "shared.js defines renderInlineChecklist()",
        fn_match is not None,
        "function definition not found",
    )
    if fn_match is None:
        return
    fn_chunk = content[fn_match.start():fn_match.start() + 5000]
    has_call = "enableTouchDrag" in fn_chunk
    check(
        "renderInlineChecklist() calls enableTouchDrag()",
        has_call,
        "enableTouchDrag not found in renderInlineChecklist body",
    )


def test_enableDragToReorder_calls_enableTouchDrag():
    """Verify enableDragToReorder integrates enableTouchDrag (Task 5.3)."""
    print("\n── enableDragToReorder → enableTouchDrag integration (Req 9.4) ──")
    content = _read("shared.js")
    if content is None:
        return
    fn_match = re.search(
        r"function\s+enableDragToReorder\s*\(", content
    )
    check(
        "shared.js defines enableDragToReorder()",
        fn_match is not None,
        "function definition not found",
    )
    if fn_match is None:
        return
    fn_chunk = content[fn_match.start():fn_match.start() + 5000]
    has_call = "enableTouchDrag" in fn_chunk
    check(
        "enableDragToReorder() calls enableTouchDrag()",
        has_call,
        "enableTouchDrag not found in enableDragToReorder body",
    )


if __name__ == "__main__":
    print("=" * 56)
    print("  Touch Drag Adapter Unit Tests (Task 5.4)")
    print("  Requirements: 9.1, 9.5")
    print("=" * 56)

    test_enableTouchDrag_definition()
    test_touch_coordinate_extraction()
    test_preventDefault_on_touchmove()
    test_try_catch_noop_fallback()
    test_callback_support()
    test_enableCalendarDrag_calls_enableTouchDrag()
    test_renderInlineChecklist_calls_enableTouchDrag()
    test_enableDragToReorder_calls_enableTouchDrag()

    print(f"\n{'=' * 56}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 56}")

    sys.exit(1 if failed else 0)
