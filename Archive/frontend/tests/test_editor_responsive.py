#!/usr/bin/env python3
"""
Unit tests for editor responsive layout (Task 7.3).

Verifies that shared-editor.css and editor.css contain the expected
responsive media query blocks introduced by Tasks 7.1 and 7.2.

Validates: Requirements 7.1, 7.2

Run:  python frontend/tests/test_editor_responsive.py
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


def _extract_media_blocks(css_content, max_width):
    """Extract ALL @media (max-width: <max_width>px) blocks, concatenated.

    Handles nested braces so each top-level block is fully captured.
    Returns None if no matching media query is found.
    """
    pattern = rf"@media\s*\(\s*max-width:\s*{max_width}px\s*\)"
    parts = []
    for match in re.finditer(pattern, css_content):
        start = css_content.index("{", match.start())
        depth = 0
        for i in range(start, len(css_content)):
            if css_content[i] == "{":
                depth += 1
            elif css_content[i] == "}":
                depth -= 1
                if depth == 0:
                    parts.append(css_content[start : i + 1])
                    break
    return "\n".join(parts) if parts else None


# ── shared-editor.css — 768px tablet breakpoint (Req 7.1) ──────────────


def test_shared_editor_has_768_media_query():
    """shared-editor.css must contain a @media (max-width: 768px) block."""
    print("\n── shared-editor.css 768px media query (Req 7.1) ──")
    content = _read("shared-editor.css")
    check("shared-editor.css exists", content is not None, "file not found")
    if content is None:
        return
    block = _extract_media_blocks(content, 768)
    check(
        "shared-editor.css contains @media (max-width: 768px)",
        block is not None,
        "media query block not found",
    )


def test_768_grid_single_column():
    """The 768px block must collapse .main-zones-grid to single column."""
    print("\n── .main-zones-grid single column at 768px (Req 7.1) ──")
    content = _read("shared-editor.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 768)
    if block is None:
        check(".main-zones-grid rule", False, "768px media block missing")
        return
    has_selector = ".main-zones-grid" in block
    has_single_col = bool(re.search(r"grid-template-columns\s*:\s*1fr", block))
    check(
        ".main-zones-grid selector present in 768px block",
        has_selector,
        "selector not found",
    )
    check(
        "grid-template-columns: 1fr in 768px block",
        has_single_col,
        "single-column rule not found",
    )


def test_768_hideWhenNarrow():
    """The 768px block must hide .hideWhenNarrow elements."""
    print("\n── .hideWhenNarrow display:none at 768px (Req 7.4) ──")
    content = _read("shared-editor.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 768)
    if block is None:
        check(".hideWhenNarrow rule", False, "768px media block missing")
        return
    has_selector = ".hideWhenNarrow" in block
    has_display_none = bool(re.search(r"display\s*:\s*none", block))
    check(
        ".hideWhenNarrow selector present in 768px block",
        has_selector,
        "selector not found",
    )
    check(
        "display: none rule in 768px block",
        has_display_none,
        "display:none not found",
    )


# ── shared-editor.css — 480px mobile breakpoint (Req 7.2) ──────────────


def test_shared_editor_has_480_media_query():
    """shared-editor.css must contain a @media (max-width: 480px) block."""
    print("\n── shared-editor.css 480px media query (Req 7.2) ──")
    content = _read("shared-editor.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    check(
        "shared-editor.css contains @media (max-width: 480px)",
        block is not None,
        "media query block not found",
    )


def test_480_header_row_stacks():
    """The 480px block must stack .header-row vertically."""
    print("\n── .header-row flex-direction:column at 480px (Req 7.2) ──")
    content = _read("shared-editor.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    if block is None:
        check(".header-row rule", False, "480px media block missing")
        return
    has_selector = ".header-row" in block
    has_col = bool(re.search(r"flex-direction\s*:\s*column", block))
    check(
        ".header-row selector present in 480px block",
        has_selector,
        "selector not found",
    )
    check(
        "flex-direction: column for .header-row",
        has_col,
        "flex-direction:column not found",
    )


# ── editor.css — 480px mobile breakpoint (Req 7.3, 7.6) ───────────────


def test_editor_css_has_480_media_query():
    """editor.css must contain a @media (max-width: 480px) block."""
    print("\n── editor.css 480px media query (Req 7.3) ──")
    content = _read("editor.css")
    check("editor.css exists", content is not None, "file not found")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    check(
        "editor.css contains @media (max-width: 480px)",
        block is not None,
        "media query block not found",
    )


def test_editor_480_titleWeatherContainer():
    """The editor.css 480px block must stack #titleWeatherContainer vertically."""
    print("\n── #titleWeatherContainer flex-direction:column at 480px (Req 7.3) ──")
    content = _read("editor.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    if block is None:
        check("#titleWeatherContainer rule", False, "480px media block missing")
        return
    has_selector = "#titleWeatherContainer" in block
    has_col = bool(re.search(r"flex-direction\s*:\s*column", block))
    check(
        "#titleWeatherContainer selector present in 480px block",
        has_selector,
        "selector not found",
    )
    check(
        "flex-direction: column for #titleWeatherContainer",
        has_col,
        "flex-direction:column not found",
    )


def test_editor_480_verticalBox():
    """The editor.css 480px block must stack .verticalBox vertically."""
    print("\n── .verticalBox flex-direction:column at 480px (Req 7.6) ──")
    content = _read("editor.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    if block is None:
        check(".verticalBox rule", False, "480px media block missing")
        return
    has_selector = ".verticalBox" in block
    has_col = bool(re.search(r"flex-direction\s*:\s*column", block))
    check(
        ".verticalBox selector present in 480px block",
        has_selector,
        "selector not found",
    )
    check(
        "flex-direction: column for .verticalBox",
        has_col,
        "flex-direction:column not found",
    )


if __name__ == "__main__":
    print("=" * 60)
    print("  Editor Responsive Layout Unit Tests (Task 7.3)")
    print("  Requirements: 7.1, 7.2")
    print("=" * 60)

    test_shared_editor_has_768_media_query()
    test_768_grid_single_column()
    test_768_hideWhenNarrow()
    test_shared_editor_has_480_media_query()
    test_480_header_row_stacks()
    test_editor_css_has_480_media_query()
    test_editor_480_titleWeatherContainer()
    test_editor_480_verticalBox()

    print(f"\n{'=' * 60}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 60}")

    sys.exit(1 if failed else 0)
