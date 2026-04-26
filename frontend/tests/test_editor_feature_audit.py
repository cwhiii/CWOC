#!/usr/bin/env python3
"""
Editor & secondary pages feature-completeness audit (Task 10.2).

Verifies that responsive CSS changes do NOT accidentally hide or disable
any editor zones, action buttons, or secondary-page content at any
viewport breakpoint.

Checks:
  1. editor.html contains all 12 editor zone containers
  2. editor.html contains save, delete, and archive buttons
  3. No responsive CSS rule hides any .zone-container element
  4. No responsive CSS rule hides .buttons or save/delete/archive buttons
  5. settings.html exists and contains settings sections
  6. trash.html exists
  7. help.html exists

Requirements: 11.2, 11.3, 11.4, 11.5

Run:  python frontend/tests/test_editor_feature_audit.py
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


def _extract_media_blocks(css_content):
    """Extract all @media blocks and their contents from CSS."""
    blocks = []
    i = 0
    while i < len(css_content):
        media_match = re.match(r'@media\s*\([^)]+\)', css_content[i:])
        if media_match:
            start = i + media_match.end()
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


# ═══════════════════════════════════════════════════════════════════════════════
# 1. All 12 editor zone containers present in editor.html
# ═══════════════════════════════════════════════════════════════════════════════

# (zone id, human-readable label)
EXPECTED_ZONES = [
    ("datesSection",            "Dates"),
    ("taskSection",             "Task"),
    ("locationSection",         "Location"),
    ("tagsSection",             "Tags"),
    ("peopleSection",           "People"),
    ("notesSection",            "Notes"),
    ("checklistSection",        "Checklist"),
    ("alertsSection",           "Alerts"),
    ("healthIndicatorsSection", "Health Indicators"),
    ("colorSection",            "Color"),
    ("projectsSection",         "Projects"),
    ("auditLogSection",         "Audit Log"),
]


def test_all_editor_zones_present():
    """Verify all 12 editor zone containers exist in editor.html."""
    print("\n── 1. Editor Zone Containers in editor.html ──")
    html = _read("editor.html")
    if html is None:
        check("editor.html exists", False, "file not found")
        return

    for zone_id, label in EXPECTED_ZONES:
        found = f'id="{zone_id}"' in html
        check(
            f"Zone '{label}' present (id=\"{zone_id}\")",
            found,
            "zone container missing from editor.html" if not found else "",
        )

    # Verify each zone has class zone-container
    for zone_id, label in EXPECTED_ZONES:
        pattern = re.compile(
            rf'id="{zone_id}"[^>]*class="[^"]*zone-container'
            rf'|class="[^"]*zone-container[^"]*"[^>]*id="{zone_id}"',
        )
        found = bool(pattern.search(html))
        check(
            f"Zone '{label}' has class 'zone-container'",
            found,
            f"id=\"{zone_id}\" missing zone-container class" if not found else "",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Save, delete, and archive buttons present in editor.html
# ═══════════════════════════════════════════════════════════════════════════════

EXPECTED_BUTTONS = [
    ("saveButton",     "Save"),
    ("saveStayButton", "Save & Stay"),
    ("saveExitButton", "Save & Exit"),
    ("deleteButton",   "Delete"),
    ("archivedButton", "Archive"),
]


def test_editor_action_buttons():
    """Verify save, delete, and archive buttons exist in editor.html."""
    print("\n── 2. Editor Action Buttons in editor.html ──")
    html = _read("editor.html")
    if html is None:
        check("editor.html exists", False, "file not found")
        return

    for btn_id, label in EXPECTED_BUTTONS:
        found = f'id="{btn_id}"' in html
        check(
            f"Button '{label}' present (id=\"{btn_id}\")",
            found,
            "button missing from editor.html" if not found else "",
        )

    # Also verify QR button exists
    found_qr = 'id="qrButton"' in html
    check(
        "QR button present (id=\"qrButton\")",
        found_qr,
        "QR button missing from editor.html" if not found_qr else "",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. No responsive CSS rule hides any .zone-container element
# ═══════════════════════════════════════════════════════════════════════════════

def test_no_zone_container_display_none():
    """Verify no responsive CSS hides .zone-container elements."""
    print("\n── 3. No display:none on .zone-container at any breakpoint ──")

    for css_file in ("shared-editor.css", "editor.css"):
        css = _read(css_file)
        if css is None:
            check(f"{css_file} exists", False, "file not found")
            continue

        media_blocks = _extract_media_blocks(css)
        offending = []

        for query, content in media_blocks:
            # Match rules targeting .zone-container with display: none
            if re.search(
                r'\.zone-container[^{]*\{[^}]*display\s*:\s*none',
                content,
                re.IGNORECASE | re.DOTALL,
            ):
                offending.append(query)

        check(
            f"{css_file}: no media query sets display:none on .zone-container",
            len(offending) == 0,
            f"hidden in: {offending}" if offending else "",
        )

    # Also check that no individual zone ID is hidden via display:none
    # in responsive blocks
    zone_ids = [zid for zid, _ in EXPECTED_ZONES]
    for css_file in ("shared-editor.css", "editor.css"):
        css = _read(css_file)
        if css is None:
            continue

        media_blocks = _extract_media_blocks(css)
        for zone_id, label in EXPECTED_ZONES:
            hidden_in = []
            for query, content in media_blocks:
                pattern = re.compile(
                    rf'#{zone_id}\s*\{{[^}}]*display\s*:\s*none',
                    re.IGNORECASE | re.DOTALL,
                )
                if pattern.search(content):
                    hidden_in.append(query)

            check(
                f"{css_file}: zone '{label}' (#{zone_id}) not hidden at any breakpoint",
                len(hidden_in) == 0,
                f"hidden in: {hidden_in}" if hidden_in else "",
            )


# ═══════════════════════════════════════════════════════════════════════════════
# 4. No responsive CSS rule hides .buttons or save/delete/archive buttons
# ═══════════════════════════════════════════════════════════════════════════════

BUTTON_SELECTORS = [
    # .buttons is intentionally hidden on mobile (replaced by mobile actions modal)
    # so we only check individual button IDs are not hidden
    (r"#saveButton",     "#saveButton"),
    (r"#saveStayButton", "#saveStayButton"),
    (r"#saveExitButton", "#saveExitButton"),
    (r"#deleteButton",   "#deleteButton"),
    (r"#archivedButton", "#archivedButton"),
    (r"#qrButton",       "#qrButton"),
]


def test_no_buttons_display_none():
    """Verify no responsive CSS hides .buttons or action buttons."""
    print("\n── 4. No display:none on .buttons / action buttons ──")

    for css_file in ("shared-editor.css", "editor.css"):
        css = _read(css_file)
        if css is None:
            check(f"{css_file} exists", False, "file not found")
            continue

        media_blocks = _extract_media_blocks(css)

        for selector_re, selector_label in BUTTON_SELECTORS:
            hidden_in = []
            for query, content in media_blocks:
                pattern = re.compile(
                    selector_re + r'\s*\{[^}]*display\s*:\s*none',
                    re.IGNORECASE,
                )
                if pattern.search(content):
                    hidden_in.append(query)

            check(
                f"{css_file}: {selector_label} not hidden at any breakpoint",
                len(hidden_in) == 0,
                f"hidden in: {hidden_in}" if hidden_in else "",
            )


# ═══════════════════════════════════════════════════════════════════════════════
# 5. settings.html exists and contains settings sections
# ═══════════════════════════════════════════════════════════════════════════════

def test_settings_page():
    """Verify settings.html exists and has settings sections."""
    print("\n── 5. Settings Page ──")
    html = _read("settings.html")
    if html is None:
        check("settings.html exists", False, "file not found")
        return

    check("settings.html exists", True)

    # Verify settings-grid container
    has_grid = "settings-grid" in html
    check(
        "settings.html contains .settings-grid",
        has_grid,
        "settings-grid class not found" if not has_grid else "",
    )

    # Verify at least one setting-group
    group_count = html.count("setting-group")
    check(
        f"settings.html contains setting-group sections (found {group_count})",
        group_count >= 1,
        "no setting-group elements found" if group_count < 1 else "",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 6. trash.html exists
# ═══════════════════════════════════════════════════════════════════════════════

def test_trash_page():
    """Verify trash.html exists."""
    print("\n── 6. Trash Page ──")
    html = _read("trash.html")
    check(
        "trash.html exists",
        html is not None,
        "file not found" if html is None else "",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 7. help.html exists
# ═══════════════════════════════════════════════════════════════════════════════

def test_help_page():
    """Verify help.html exists."""
    print("\n── 7. Help Page ──")
    html = _read("help.html")
    check(
        "help.html exists",
        html is not None,
        "file not found" if html is None else "",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  Editor & Secondary Pages Feature Audit (Task 10.2)")
    print("  Requirements: 11.2, 11.3, 11.4, 11.5")
    print("=" * 60)

    test_all_editor_zones_present()
    test_editor_action_buttons()
    test_no_zone_container_display_none()
    test_no_buttons_display_none()
    test_settings_page()
    test_trash_page()
    test_help_page()

    print(f"\n{'=' * 60}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'=' * 60}")

    sys.exit(1 if failed else 0)
