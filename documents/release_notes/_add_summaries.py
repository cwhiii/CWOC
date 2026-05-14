#!/usr/bin/env python3
"""Add day summaries to each daily release notes file (major features only)."""
import os

BASE = "/Users/cwhiii/Personal/Misc/Development/CWOC/documents/release_notes"

# Summaries of MAJOR features for each day (only radically new/significant stuff)
summaries = {
    "20260430": [
        "Added invitation/RSVP system for shared chits",
        "Introduced per-version release notes with modal viewer",
    ],
    "20260501": [
        "Habits overhaul — explicit opt-in habit tracking with streaks and goals",
        "Added Tailscale VPN administration to Settings",
        "Project Kanban board drag-and-drop reordering",
    ],
    "20260502": [
        "Added interactive Maps View page with Leaflet",
        "Added Maps People Mode for contact locations",
        "Added floating Calculator popover (F4 hotkey)",
        "Added Kiosk mode (full-screen dashboard)",
    ],
    "20260503": [
        "Added email integration — Email tab, email zone in editor, send/receive",
        "Added iCalendar (.ics) file import",
    ],
    "20260504": [
        "Email editor expand modal (full viewport)",
        "Birthday/Anniversary calendar entries from contacts",
        "Email CC/BCC support",
    ],
    "20260505": [
        "Integrated Milkdown WYSIWYG markdown editor for Notes zone",
        "Cross-folder email thread grouping",
        "Fixed database locking issues with email sync",
    ],
    "20260506": [
        "Email attachment handling improvements (inline thumbnails, auto-zone)",
        "Email compose/reply polish and ESC handling fixes",
    ],
    "20260509": [
        "Added chit-level snooze (hide until date/time)",
        "Added chit revert from audit log",
        "Added Email Thread Nests (attach chits to email threads)",
        "Map thumbnails on chit cards",
    ],
    "20260511": [
        "Added auto-save for chit editor (2-second debounce)",
        "Contacts soft-delete with trash/restore",
        "Added Custom Objects Editor (user-defined zones with custom fields)",
        "QR code contact sharing (vCard)",
    ],
    "20260512": [
        "Custom Objects Editor — zone preview, drag-to-reorder indicators",
        "Enhanced global search with snippets and dropdown filters",
        "Added chit prerequisites/dependencies system",
    ],
    "20260513": [
        "Added Print Chit feature (formatted print of all zones)",
        "URL hash routing for bookmarkable dashboard views",
        "Added habit notification direction (\"Will Be Missed Within\")",
        "Weather notifications with progressive disclosure UI",
    ],
    "20260514": [
        "Added Cron Triggers & Habit Rules engine",
        "Camera capture for profile images",
        "Custom Filters & Sorting per-view (replacing Default Filters)",
        "Checklist clipboard operations (paste as items, copy incomplete)",
    ],
}

for date, bullets in summaries.items():
    path = os.path.join(BASE, f"release_notes-{date}.md")
    if not os.path.exists(path):
        continue
    
    with open(path, "r") as f:
        content = f.read()
    
    # Build summary block
    summary_lines = "\n".join(f"- {b}" for b in bullets)
    summary_block = f"# {date} Highlights\n\n{summary_lines}\n\n---\n\n"
    
    # Prepend summary
    with open(path, "w") as f:
        f.write(summary_block + content)
    
    print(f"Added summary to {date} ({len(bullets)} highlights)")
