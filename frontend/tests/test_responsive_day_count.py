#!/usr/bin/env python3
"""
Unit tests for responsive day count logic (Task 4.5).

Verifies that main.js contains the expected responsive calendar helper
functions and logic patterns introduced by Tasks 4.1 and 4.4.

Validates: Requirements 4.1, 4.2

Run:  python frontend/tests/test_responsive_day_count.py
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


def _extract_function_body(content, func_name, chunk_size=600):
    """Extract a chunk of text starting at a function definition."""
    match = re.search(
        rf"function\s+{re.escape(func_name)}\s*\(", content
    )
    if match is None:
        return None
    return content[match.start() : match.start() + chunk_size]


def test_getResponsiveDayCount_exists():
    """Verify main.js defines the _getResponsiveDayCount function."""
    print("\n── _getResponsiveDayCount definition (Req 4.1, 4.2) ──")
    content = _read("main.js")
    check("main.js exists", content is not None, "file not found")
    if content is None:
        return
    has_fn = bool(
        re.search(r"function\s+_getResponsiveDayCount\s*\(", content)
    )
    check(
        "main.js defines _getResponsiveDayCount()",
        has_fn,
        "function definition not found",
    )


def test_getResponsiveDayCount_480_breakpoint():
    """Verify the function body contains the 480px mobile breakpoint."""
    print("\n── 480px breakpoint in _getResponsiveDayCount (Req 4.1) ──")
    content = _read("main.js")
    if content is None:
        return
    body = _extract_function_body(content, "_getResponsiveDayCount")
    check(
        "_getResponsiveDayCount body extracted",
        body is not None,
        "could not locate function",
    )
    if body is None:
        return
    has_480 = bool(re.search(r"<=?\s*480", body))
    check(
        "_getResponsiveDayCount checks 480px breakpoint",
        has_480,
        "480px comparison not found in function body",
    )


def test_getResponsiveDayCount_768_breakpoint():
    """Verify the function body contains the 768px tablet breakpoint."""
    print("\n── 768px breakpoint in _getResponsiveDayCount (Req 4.2) ──")
    content = _read("main.js")
    if content is None:
        return
    body = _extract_function_body(content, "_getResponsiveDayCount")
    if body is None:
        return
    has_768 = bool(re.search(r"<=?\s*768", body))
    check(
        "_getResponsiveDayCount checks 768px breakpoint",
        has_768,
        "768px comparison not found in function body",
    )


def test_getResponsiveDayCount_clamping():
    """Verify the function clamps the result to 1–7 using Math.max/Math.min."""
    print("\n── Clamping to 1–7 range (Req 4.1, 4.2) ──")
    content = _read("main.js")
    if content is None:
        return
    body = _extract_function_body(content, "_getResponsiveDayCount")
    if body is None:
        return
    has_max = "Math.max" in body
    has_min = "Math.min" in body
    check(
        "_getResponsiveDayCount uses Math.max for lower clamp",
        has_max,
        "Math.max not found in function body",
    )
    check(
        "_getResponsiveDayCount uses Math.min for upper clamp",
        has_min,
        "Math.min not found in function body",
    )


def test_getBreakpointCategory_exists():
    """Verify main.js defines the _getBreakpointCategory function."""
    print("\n── _getBreakpointCategory definition (Req 4.1) ──")
    content = _read("main.js")
    if content is None:
        return
    has_fn = bool(
        re.search(r"function\s+_getBreakpointCategory\s*\(", content)
    )
    check(
        "main.js defines _getBreakpointCategory()",
        has_fn,
        "function definition not found",
    )


def test_onDebouncedResize_exists_with_200ms():
    """Verify main.js defines _onDebouncedResize with a 200ms debounce."""
    print("\n── _onDebouncedResize with 200ms debounce (Req 4.1, 4.2) ──")
    content = _read("main.js")
    if content is None:
        return
    body = _extract_function_body(content, "_onDebouncedResize", 800)
    check(
        "_onDebouncedResize function found",
        body is not None,
        "function definition not found",
    )
    if body is None:
        return
    has_200 = bool(re.search(r"200", body))
    check(
        "_onDebouncedResize uses 200ms debounce delay",
        has_200,
        "200ms timeout value not found in function body",
    )


def test_onDebouncedResize_resets_dayOffset():
    """Verify the debounce handler resets _weekViewDayOffset to 0 on breakpoint crossing."""
    print("\n── _weekViewDayOffset reset on breakpoint crossing ──")
    content = _read("main.js")
    if content is None:
        return
    body = _extract_function_body(content, "_onDebouncedResize", 800)
    if body is None:
        return
    has_reset = "_weekViewDayOffset = 0" in body
    check(
        "_onDebouncedResize resets _weekViewDayOffset to 0",
        has_reset,
        "_weekViewDayOffset = 0 not found in debounce handler",
    )


if __name__ == "__main__":
    print("=" * 56)
    print("  Responsive Day Count Unit Tests (Task 4.5)")
    print("  Requirements: 4.1, 4.2")
    print("=" * 56)

    test_getResponsiveDayCount_exists()
    test_getResponsiveDayCount_480_breakpoint()
    test_getResponsiveDayCount_768_breakpoint()
    test_getResponsiveDayCount_clamping()
    test_getBreakpointCategory_exists()
    test_onDebouncedResize_exists_with_200ms()
    test_onDebouncedResize_resets_dayOffset()

    print(f"\n{'=' * 56}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 56}")

    sys.exit(1 if failed else 0)
