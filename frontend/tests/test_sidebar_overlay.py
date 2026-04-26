#!/usr/bin/env python3
"""
Unit tests for sidebar overlay logic (Task 2.3).

Verifies that shared.js and main.js contain the expected sidebar overlay
functions and logic patterns introduced by Tasks 2.1 and 2.2.

Validates: Requirements 3.1, 3.2, 3.3

Run:  python frontend/tests/test_sidebar_overlay.py
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


def test_shared_js_initMobileSidebar():
    """Verify shared.js defines the initMobileSidebar function."""
    print("\n── initMobileSidebar definition (Req 3.1, 3.2) ──")
    content = _read("shared.js")
    check("shared.js exists", content is not None, "file not found")
    if content is None:
        return
    has_fn = bool(re.search(r"function\s+initMobileSidebar\s*\(", content))
    check(
        "shared.js defines initMobileSidebar()",
        has_fn,
        "function definition not found",
    )


def test_shared_js_onSidebarBackdropClick():
    """Verify shared.js defines the _onSidebarBackdropClick handler."""
    print("\n── _onSidebarBackdropClick definition (Req 3.3) ──")
    content = _read("shared.js")
    if content is None:
        return
    has_fn = bool(re.search(r"function\s+_onSidebarBackdropClick\s*\(", content))
    check(
        "shared.js defines _onSidebarBackdropClick()",
        has_fn,
        "function definition not found",
    )


def test_shared_js_ensureSidebarBackdrop():
    """Verify shared.js defines the _ensureSidebarBackdrop function."""
    print("\n── _ensureSidebarBackdrop definition (Req 3.2) ──")
    content = _read("shared.js")
    if content is None:
        return
    has_fn = bool(re.search(r"function\s+_ensureSidebarBackdrop\s*\(", content))
    check(
        "shared.js defines _ensureSidebarBackdrop()",
        has_fn,
        "function definition not found",
    )


def test_shared_js_backdrop_removes_active():
    """Verify the backdrop click handler removes the 'active' class from the sidebar."""
    print("\n── Backdrop click removes 'active' class (Req 3.3) ──")
    content = _read("shared.js")
    if content is None:
        return
    # The handler should remove 'active' from the sidebar element
    has_remove = bool(
        re.search(r"classList\.remove\(\s*['\"]active['\"]\s*\)", content)
    )
    check(
        "shared.js backdrop handler removes 'active' class",
        has_remove,
        "classList.remove('active') not found in shared.js",
    )


def test_main_js_toggleSidebar_mobile_check():
    """Verify toggleSidebar in main.js checks _isMobileOverlay()."""
    print("\n── toggleSidebar mobile overlay check (Req 3.2, 3.3) ──")
    content = _read("main.js")
    check("main.js exists", content is not None, "file not found")
    if content is None:
        return
    # Extract the toggleSidebar function body
    match = re.search(
        r"function\s+toggleSidebar\s*\(\s*\)\s*\{", content
    )
    check(
        "main.js defines toggleSidebar()",
        match is not None,
        "function definition not found",
    )
    if match is None:
        return
    # Check that _isMobileOverlay() is called within the file
    # (specifically in the context of toggleSidebar)
    fn_start = match.start()
    # Grab a reasonable chunk after the function start
    fn_chunk = content[fn_start : fn_start + 600]
    has_mobile_check = "_isMobileOverlay()" in fn_chunk
    check(
        "toggleSidebar() contains _isMobileOverlay() check",
        has_mobile_check,
        "_isMobileOverlay() not found in toggleSidebar body",
    )


def test_main_js_domcontentloaded_calls_init():
    """Verify DOMContentLoaded handler in main.js calls initMobileSidebar()."""
    print("\n── DOMContentLoaded calls initMobileSidebar (Req 3.1) ──")
    content = _read("main.js")
    if content is None:
        return
    # Find the DOMContentLoaded listener
    match = re.search(r'addEventListener\(\s*["\']DOMContentLoaded["\']', content)
    check(
        "main.js has DOMContentLoaded listener",
        match is not None,
        "DOMContentLoaded listener not found",
    )
    if match is None:
        return
    # Check that initMobileSidebar() is called after DOMContentLoaded
    dcl_start = match.start()
    dcl_chunk = content[dcl_start : dcl_start + 800]
    has_init_call = "initMobileSidebar()" in dcl_chunk
    check(
        "DOMContentLoaded handler calls initMobileSidebar()",
        has_init_call,
        "initMobileSidebar() call not found near DOMContentLoaded",
    )


def test_shared_js_resize_listener():
    """Verify shared.js has a resize event listener for mobile boundary crossing."""
    print("\n── Resize listener for 768px boundary (Req 3.1) ──")
    content = _read("shared.js")
    if content is None:
        return
    has_resize = bool(
        re.search(r"addEventListener\(\s*['\"]resize['\"]", content)
    )
    check(
        "shared.js registers a resize event listener",
        has_resize,
        "window resize listener not found",
    )
    # Verify it references the 768px boundary logic
    has_boundary = bool(re.search(r"_isMobileOverlay|768", content))
    check(
        "shared.js resize handler references mobile boundary (768px)",
        has_boundary,
        "no 768px boundary logic found near resize listener",
    )


if __name__ == "__main__":
    print("=" * 56)
    print("  Sidebar Overlay Unit Tests (Task 2.3)")
    print("  Requirements: 3.1, 3.2, 3.3")
    print("=" * 56)

    test_shared_js_initMobileSidebar()
    test_shared_js_onSidebarBackdropClick()
    test_shared_js_ensureSidebarBackdrop()
    test_shared_js_backdrop_removes_active()
    test_main_js_toggleSidebar_mobile_check()
    test_main_js_domcontentloaded_calls_init()
    test_shared_js_resize_listener()

    print(f"\n{'=' * 56}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 56}")

    sys.exit(1 if failed else 0)
