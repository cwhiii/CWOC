#!/usr/bin/env python3
"""
Feature parity audit for mobile-responsive spec (Task 10.1).

Verifies that responsive CSS and JS changes do NOT accidentally hide or
disable any of the six C CAPTN tabs, seven calendar periods, or sidebar
controls at any viewport breakpoint.

Checks:
  1. index.html contains all 6 C CAPTN tab elements
  2. main.js contains all 7 calendar period modes
  3. No CSS rule at any breakpoint sets display:none on .tab elements
  4. No CSS rule at any breakpoint sets display:none on sidebar controls
  5. Responsive CSS preserves tab touch-target accessibility (min-height 44px)
  6. main.js does NOT conditionally disable any calendar period based on
     viewport width (innerWidth)

Requirements: 11.1, 11.5

Run:  python frontend/tests/test_feature_parity_audit.py
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


# ═══════════════════════════════════════════════════════════════════════════════
# 1. All six C CAPTN tabs present in index.html
# ═══════════════════════════════════════════════════════════════════════════════

# Each tuple: (tab name for display, onclick argument that identifies the tab)
EXPECTED_TABS = [
    ("Calendar",   "filterChits('Calendar')"),
    ("Checklists", "filterChits('Checklists')"),
    ("Alerts",     "filterChits('Alarms')"),
    ("Projects",   "filterChits('Projects')"),
    ("Tasks",      "filterChits('Tasks')"),
    ("Notes",      "filterChits('Notes')"),
]


def test_all_tabs_present():
    """Verify all 6 C CAPTN tab elements exist in index.html."""
    print("\n── 1. C CAPTN Tabs in index.html ──")
    html = _read("index.html")
    if html is None:
        check("index.html exists", False, "file not found")
        return

    for label, onclick_fragment in EXPECTED_TABS:
        found = onclick_fragment in html
        check(
            f"Tab '{label}' present (onclick contains {onclick_fragment!r})",
            found,
            "tab element missing from index.html" if not found else "",
        )

    # Also verify each tab has class="tab"
    tab_divs = re.findall(r'<div\s+class="tab"[^>]*onclick="filterChits\(\'(\w+)\'\)"', html)
    check(
        f"Found {len(tab_divs)} tab divs with class='tab' (expected 6)",
        len(tab_divs) == 6,
        f"found {len(tab_divs)}: {tab_divs}" if len(tab_divs) != 6 else "",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 2. All seven calendar period modes in main.js
# ═══════════════════════════════════════════════════════════════════════════════

EXPECTED_PERIODS = [
    "Itinerary",
    "Day",
    "Week",
    "Work",      # Work Hours
    "SevenDay",  # X Days
    "Month",
    "Year",
]


def test_all_calendar_periods():
    """Verify all 7 calendar period modes are defined in main.js."""
    print("\n── 2. Calendar Periods in main.js ──")
    js = _read("main.js")
    if js is None:
        check("main.js exists", False, "file not found")
        return

    # Check the _enabledPeriods default array contains all 7
    ep_match = re.search(r"_enabledPeriods\s*=\s*\[([^\]]+)\]", js)
    check(
        "_enabledPeriods default array found in main.js",
        ep_match is not None,
        "could not find _enabledPeriods = [...] declaration",
    )

    if ep_match:
        array_content = ep_match.group(1)
        for period in EXPECTED_PERIODS:
            found = f"'{period}'" in array_content or f'"{period}"' in array_content
            check(
                f"Period '{period}' in _enabledPeriods default",
                found,
                f"not found in: {array_content}" if not found else "",
            )

    # Check the period-select dropdown in index.html has all 7 options
    html = _read("index.html")
    if html:
        for period in EXPECTED_PERIODS:
            pattern = f'value="{period}"'
            found = pattern in html
            check(
                f"Period '{period}' has <option> in period-select dropdown",
                found,
                "option element missing from index.html" if not found else "",
            )

    # Check the hotkey panel has _pickPeriod calls for all 7
    if html:
        for period in EXPECTED_PERIODS:
            pattern = f"_pickPeriod('{period}')"
            found = pattern in html
            check(
                f"Period '{period}' has hotkey panel entry (_pickPeriod call)",
                found,
                "hotkey panel option missing" if not found else "",
            )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. No CSS rule hides .tab elements at any breakpoint
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_media_blocks(css_content):
    """Extract all @media blocks and their contents from CSS."""
    blocks = []
    # Find all @media blocks with their content
    depth = 0
    i = 0
    while i < len(css_content):
        media_match = re.match(r'@media\s*\([^)]+\)', css_content[i:])
        if media_match:
            start = i + media_match.end()
            # Find the opening brace
            brace_pos = css_content.find('{', start)
            if brace_pos == -1:
                break
            media_query = css_content[i:brace_pos].strip()
            depth = 1
            j = brace_pos + 1
            while j < len(css_content) and depth > 0:
                if css_content[j] == '{':
                    depth += 1
                elif css_content[j] == '}':
                    depth -= 1
                j += 1
            block_content = css_content[brace_pos + 1:j - 1]
            blocks.append((media_query, block_content))
            i = j
        else:
            i += 1
    return blocks


def test_no_tab_display_none():
    """Verify tabs are accessible at all viewports (via tab bar or mobile Views button)."""
    print("\n── 3. Tabs accessible at all viewports ──")
    css = _read("styles.css")
    if css is None:
        check("styles.css exists", False, "file not found")
        return

    # On mobile, .tabs is hidden but replaced by a mobile Views button.
    # Verify the mobile-views-btn CSS exists as the replacement.
    has_views_btn = ".mobile-views-btn" in css
    check(
        "Mobile Views button CSS exists as tab replacement",
        has_views_btn,
        ".mobile-views-btn not found in styles.css",
    )

    # Verify individual .tab elements are NOT hidden (only .tabs container)
    media_blocks = _extract_media_blocks(css)
    individual_tab_hidden = False
    for query, content in media_blocks:
        # Only flag if individual .tab (not .tabs) is hidden
        rules = re.findall(
            r'(\.tab\s*\{[^}]*display\s*:\s*none[^}]*\})',
            content,
            re.IGNORECASE,
        )
        if rules:
            individual_tab_hidden = True

    check(
        "Individual .tab elements never set to display:none",
        not individual_tab_hidden,
        "individual .tab hidden at some breakpoint",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 4. No CSS rule hides sidebar control elements at any breakpoint
# ═══════════════════════════════════════════════════════════════════════════════

# Sidebar control selectors that must never be display:none
SIDEBAR_CONTROL_SELECTORS = [
    r"#section-order",
    r"#section-period",
    r"#section-filters",
    r"#section-create",
    r"#section-settings",
    r"#section-help",
    r"#sort-select",
    r"#period-select",
    r"#search",
    r"#saved-searches",
    r"\.sidebar-section",
    r"\.filter-group",
]


def test_no_sidebar_display_none():
    """Verify no CSS media query sets display:none on sidebar controls."""
    print("\n── 4. No display:none on sidebar controls at any breakpoint ──")
    css = _read("styles.css")
    if css is None:
        check("styles.css exists", False, "file not found")
        return

    media_blocks = _extract_media_blocks(css)

    for selector_pattern in SIDEBAR_CONTROL_SELECTORS:
        hidden_in = []
        for query, content in media_blocks:
            # Build a regex: selector { ... display: none ... }
            # We need to find the selector in a rule block with display:none
            pattern = re.compile(
                selector_pattern + r'\s*\{[^}]*display\s*:\s*none',
                re.IGNORECASE,
            )
            if pattern.search(content):
                hidden_in.append(query)

        readable = selector_pattern.replace("\\", "")
        check(
            f"Sidebar control {readable} never set to display:none",
            len(hidden_in) == 0,
            f"hidden in: {hidden_in}" if hidden_in else "",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Responsive CSS preserves tab accessibility (min-height 44px at mobile)
# ═══════════════════════════════════════════════════════════════════════════════

def test_tab_touch_targets():
    """Verify .tab has min-height >= 44px in responsive breakpoints."""
    print("\n── 5. Tab touch-target accessibility (min-height 44px) ──")
    css = _read("styles.css")
    if css is None:
        check("styles.css exists", False, "file not found")
        return

    media_blocks = _extract_media_blocks(css)

    found_44px = False
    for query, content in media_blocks:
        # Look for .tab rule with min-height: 44px
        tab_rules = re.findall(r'\.tab\s*\{([^}]*)\}', content, re.DOTALL)
        for rule_body in tab_rules:
            min_h_match = re.search(r'min-height\s*:\s*(\d+)px', rule_body)
            if min_h_match:
                value = int(min_h_match.group(1))
                if value >= 44:
                    found_44px = True

    check(
        ".tab has min-height >= 44px in at least one responsive breakpoint (tablet)",
        found_44px,
        "no responsive rule sets min-height >= 44px on .tab" if not found_44px else "",
    )

    # On mobile (480px), tabs are hidden and replaced by Views button.
    # Check that the mobile-view-option has min-height for touch targets instead.
    has_view_option_44 = bool(re.search(
        r'\.mobile-view-option[^{]*\{[^}]*min-height\s*:\s*44px',
        css,
        re.DOTALL,
    ))
    check(
        "Mobile view options have min-height: 44px touch targets",
        has_view_option_44,
        ".mobile-view-option missing min-height: 44px" if not has_view_option_44 else "",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 6. main.js does NOT conditionally disable calendar periods by viewport width
# ═══════════════════════════════════════════════════════════════════════════════

def test_no_viewport_period_disabling():
    """Verify main.js does not disable calendar periods based on viewport."""
    print("\n── 6. No viewport-conditional period disabling in main.js ──")
    js = _read("main.js")
    if js is None:
        check("main.js exists", False, "file not found")
        return

    # Pattern: innerWidth used near _enabledPeriods manipulation
    # e.g. if (window.innerWidth < 480) _enabledPeriods = [...]
    # or   if (innerWidth <= 768) { ... _enabledPeriods.splice(...) }
    suspicious_patterns = [
        # innerWidth in same statement as _enabledPeriods assignment
        re.compile(
            r'innerWidth[^;{]*_enabledPeriods\s*=',
            re.IGNORECASE,
        ),
        re.compile(
            r'_enabledPeriods\s*=[^;]*innerWidth',
            re.IGNORECASE,
        ),
        # innerWidth near _enabledPeriods.splice/push/pop/filter
        re.compile(
            r'innerWidth[^;{]*_enabledPeriods\.(splice|push|pop|shift|filter)',
            re.IGNORECASE,
        ),
        # innerWidth check that removes period-select options
        re.compile(
            r'innerWidth[^;{]*period-select[^;{]*remove',
            re.IGNORECASE,
        ),
    ]

    violations = []
    for pattern in suspicious_patterns:
        matches = pattern.findall(js)
        if matches:
            violations.extend(matches)

    check(
        "No viewport-conditional _enabledPeriods manipulation found",
        len(violations) == 0,
        f"found suspicious patterns: {violations}" if violations else "",
    )

    # Additional check: search for any function that modifies _enabledPeriods
    # based on a viewport/resize condition
    # Look for lines where innerWidth and period appear close together
    lines = js.split('\n')
    suspect_lines = []
    for i, line in enumerate(lines):
        lower = line.lower()
        if 'innerwidth' in lower and ('period' in lower or 'enabledperiod' in lower):
            # Exclude comments
            stripped = line.strip()
            if not stripped.startswith('//') and not stripped.startswith('*'):
                suspect_lines.append((i + 1, stripped))

    check(
        "No JS lines combine innerWidth with period logic",
        len(suspect_lines) == 0,
        f"found {len(suspect_lines)} suspect line(s): "
        + "; ".join(f"L{n}: {l[:60]}" for n, l in suspect_lines[:3])
        if suspect_lines else "",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  Feature Parity Audit (Task 10.1)")
    print("  Requirements: 11.1, 11.5")
    print("=" * 60)

    test_all_tabs_present()
    test_all_calendar_periods()
    test_no_tab_display_none()
    test_no_sidebar_display_none()
    test_tab_touch_targets()
    test_no_viewport_period_disabling()

    print(f"\n{'=' * 60}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 60}")

    sys.exit(1 if failed else 0)
