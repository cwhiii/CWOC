#!/usr/bin/env python3
"""
Smoke tests for mobile-responsive spec (Task 1.3).

Verifies:
  1. Viewport meta tag exists in index.html and editor.html
     (Requirement 1.4)
  2. No new CSS files or build tool configs were introduced
     (Requirement 1.5)

Run:  python frontend/tests/test_responsive_smoke.py
"""

import os
import re
import sys

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..")
PROJECT_ROOT = os.path.join(FRONTEND_DIR, "..")

# ── Expected CSS files (no new ones should be added) ──
ALLOWED_CSS_FILES = {
    "styles.css",
    "shared-page.css",
    "shared-editor.css",
    "editor.css",
}

# ── Build tool config files that must NOT exist at project root ──
BUILD_TOOL_FILES = [
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "webpack.config.js",
    "webpack.config.ts",
    "rollup.config.js",
    "vite.config.js",
    "vite.config.ts",
    "tsconfig.json",
    "postcss.config.js",
    "tailwind.config.js",
    ".babelrc",
    "babel.config.js",
    "babel.config.json",
    "esbuild.config.js",
    "parcel.config.js",
    ".parcelrc",
    "gulpfile.js",
    "Gruntfile.js",
]

VIEWPORT_PATTERN = re.compile(
    r'<meta\s+name=["\']viewport["\']\s+content=["\']width=device-width,\s*initial-scale=1\.0["\']',
    re.IGNORECASE,
)

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


def test_viewport_meta_tags():
    """Verify viewport meta tag in index.html and editor.html."""
    print("\n── Viewport Meta Tag ──")
    for filename in ("index.html", "editor.html"):
        filepath = os.path.join(FRONTEND_DIR, filename)
        if not os.path.isfile(filepath):
            check(f"{filename} exists", False, "file not found")
            continue
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        has_tag = bool(VIEWPORT_PATTERN.search(content))
        check(
            f'{filename} contains <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            has_tag,
            "viewport meta tag missing or malformed" if not has_tag else "",
        )


def test_no_new_css_files():
    """Verify only the allowed CSS files exist in frontend/."""
    print("\n── CSS File Inventory ──")
    css_files = {
        f for f in os.listdir(FRONTEND_DIR)
        if f.endswith(".css") and os.path.isfile(os.path.join(FRONTEND_DIR, f))
    }
    unexpected = css_files - ALLOWED_CSS_FILES
    check(
        f"No unexpected CSS files in frontend/ (found: {sorted(css_files)})",
        len(unexpected) == 0,
        f"unexpected files: {sorted(unexpected)}" if unexpected else "",
    )


def test_no_build_tool_configs():
    """Verify no build tool config files exist at project root."""
    print("\n── Build Tool Configs ──")
    found = [
        f for f in BUILD_TOOL_FILES
        if os.path.isfile(os.path.join(PROJECT_ROOT, f))
    ]
    check(
        "No build tool config files at project root",
        len(found) == 0,
        f"found: {found}" if found else "",
    )


if __name__ == "__main__":
    print("=" * 56)
    print("  Mobile Responsive Smoke Tests (Task 1.3)")
    print("  Requirements: 1.4, 1.5")
    print("=" * 56)

    test_viewport_meta_tags()
    test_no_new_css_files()
    test_no_build_tool_configs()

    print(f"\n{'=' * 56}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 56}")

    sys.exit(1 if failed else 0)
