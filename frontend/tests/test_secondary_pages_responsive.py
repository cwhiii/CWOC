#!/usr/bin/env python3
"""
Unit tests for secondary pages responsive layout (Task 8.3).

Verifies that shared-page.css contains the expected responsive media
query blocks introduced by Tasks 8.1 and 8.2.

Validates: Requirements 8.1, 8.3

Run:  python frontend/tests/test_secondary_pages_responsive.py
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


# ── shared-page.css — 768px tablet breakpoint (Req 8.1) ────────────────


def test_shared_page_has_768_media_query():
    """shared-page.css must contain a @media (max-width: 768px) block."""
    print("\n── shared-page.css 768px media query (Req 8.1) ──")
    content = _read("shared-page.css")
    check("shared-page.css exists", content is not None, "file not found")
    if content is None:
        return
    block = _extract_media_blocks(content, 768)
    check(
        "shared-page.css contains @media (max-width: 768px)",
        block is not None,
        "media query block not found",
    )


def test_768_settings_grid_single_column():
    """The 768px block must collapse .settings-grid to single column."""
    print("\n── .settings-grid single column at 768px (Req 8.1) ──")
    content = _read("shared-page.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 768)
    if block is None:
        check(".settings-grid rule", False, "768px media block missing")
        return
    has_selector = ".settings-grid" in block
    has_single_col = bool(re.search(r"grid-template-columns\s*:\s*1fr", block))
    check(
        ".settings-grid selector present in 768px block",
        has_selector,
        "selector not found",
    )
    check(
        "grid-template-columns: 1fr in 768px block",
        has_single_col,
        "single-column rule not found",
    )


# ── shared-page.css — 480px mobile breakpoint (Req 8.3) ────────────────


def test_shared_page_has_480_media_query():
    """shared-page.css must contain a @media (max-width: 480px) block."""
    print("\n── shared-page.css 480px media query (Req 8.3) ──")
    content = _read("shared-page.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    check(
        "shared-page.css contains @media (max-width: 480px)",
        block is not None,
        "media query block not found",
    )


def test_480_cwoc_table_horizontal_scroll():
    """The 480px block must set .cwoc-table to block display with overflow-x: auto."""
    print("\n── .cwoc-table horizontal scroll at 480px (Req 8.3) ──")
    content = _read("shared-page.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    if block is None:
        check(".cwoc-table rule", False, "480px media block missing")
        return
    has_selector = ".cwoc-table" in block
    has_display_block = bool(re.search(r"display\s*:\s*block", block))
    has_overflow = bool(re.search(r"overflow-x\s*:\s*auto", block))
    check(
        ".cwoc-table selector present in 480px block",
        has_selector,
        "selector not found",
    )
    check(
        "display: block for .cwoc-table",
        has_display_block,
        "display:block not found",
    )
    check(
        "overflow-x: auto for .cwoc-table",
        has_overflow,
        "overflow-x:auto not found",
    )


def test_480_header_and_buttons_stacks():
    """The 480px block must stack .header-and-buttons vertically."""
    print("\n── .header-and-buttons flex-direction:column at 480px (Req 8.2) ──")
    content = _read("shared-page.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    if block is None:
        check(".header-and-buttons rule", False, "480px media block missing")
        return
    has_selector = ".header-and-buttons" in block
    has_col = bool(re.search(r"flex-direction\s*:\s*column", block))
    check(
        ".header-and-buttons selector present in 480px block",
        has_selector,
        "selector not found",
    )
    check(
        "flex-direction: column for .header-and-buttons",
        has_col,
        "flex-direction:column not found",
    )


def test_480_help_index_single_column():
    """The 480px block must set .help-content .index ul to single column."""
    print("\n── .help-content .index ul columns:1 at 480px (Req 8.4) ──")
    content = _read("shared-page.css")
    if content is None:
        return
    block = _extract_media_blocks(content, 480)
    if block is None:
        check(".help-content .index ul rule", False, "480px media block missing")
        return
    has_selector = ".help-content" in block and ".index" in block
    has_columns_1 = bool(re.search(r"columns\s*:\s*1", block))
    check(
        ".help-content .index ul selector present in 480px block",
        has_selector,
        "selector not found",
    )
    check(
        "columns: 1 for .help-content .index ul",
        has_columns_1,
        "columns:1 not found",
    )


if __name__ == "__main__":
    print("=" * 64)
    print("  Secondary Pages Responsive Layout Unit Tests (Task 8.3)")
    print("  Requirements: 8.1, 8.3")
    print("=" * 64)

    test_shared_page_has_768_media_query()
    test_768_settings_grid_single_column()
    test_shared_page_has_480_media_query()
    test_480_cwoc_table_horizontal_scroll()
    test_480_header_and_buttons_stacks()
    test_480_help_index_single_column()

    print(f"\n{'=' * 64}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 64}")

    sys.exit(1 if failed else 0)
