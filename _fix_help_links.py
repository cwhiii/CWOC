#!/usr/bin/env python3
"""Replace inter-doc markdown links with actual app URLs in help files."""
import os
import re

HELP_DIR = "/Users/cwhiii/Personal/Misc/Development/CWOC/src/help"

# Map of markdown file links → actual app URLs
# Format: old link target → new URL
LINK_REPLACEMENTS = {
    # Settings page (different tabs/sections)
    "(settings.md)": "(/frontend/html/settings.html)",
    
    # Main pages
    "(editor.md)": "(/editor)",
    "(contacts.md)": "(/frontend/html/people.html)",
    "(maps.md)": "(/maps)",
    "(weather.md)": "(/frontend/html/weather.html)",
    "(trash.md)": "(/frontend/html/trash.html)",
    "(audit-log.md)": "(/frontend/html/audit-log.html)",
    "(custom-objects.md)": "(/frontend/html/custom-objects-editor.html)",
    
    # Help pages (these stay as help page links with hash navigation)
    "(views.md)": "(/frontend/html/help.html#views)",
    "(omni-view.md)": "(/frontend/html/help.html#omni-view)",
    "(calendar.md)": "(/frontend/html/help.html#calendar)",
    "(notes.md)": "(/frontend/html/help.html#notes)",
    "(habits.md)": "(/frontend/html/help.html#habits)",
    "(indicators.md)": "(/frontend/html/help.html#indicators)",
    "(email.md)": "(/frontend/html/help.html#email)",
    "(global-search.md)": "(/frontend/html/help.html#global-search)",
    "(kiosk.md)": "(/frontend/html/help.html#kiosk)",
    "(what-is-cwoc.md)": "(/frontend/html/help.html#what-is-cwoc)",
    "(chits.md)": "(/frontend/html/help.html#chits)",
    "(quick-edit.md)": "(/frontend/html/help.html#quick-edit)",
    "(mouse.md)": "(/frontend/html/help.html#mouse)",
    "(hotkeys.md)": "(/frontend/html/help.html#hotkeys)",
    "(recurrence.md)": "(/frontend/html/help.html#recurrence)",
    "(tags.md)": "(/frontend/html/help.html#tags)",
    "(filters.md)": "(/frontend/html/help.html#filters)",
    "(sharing.md)": "(/frontend/html/help.html#sharing)",
    "(attachments.md)": "(/frontend/html/help.html#attachments)",
    "(clocks.md)": "(/frontend/html/help.html#clocks)",
    "(saved-locations.md)": "(/frontend/html/help.html#saved-locations)",
    "(visual-indicators.md)": "(/frontend/html/help.html#visual-indicators)",
    "(calculator.md)": "(/frontend/html/help.html#calculator)",
    "(data-management.md)": "(/frontend/html/help.html#data-management)",
    "(version-management.md)": "(/frontend/html/help.html#version-management)",
    "(dependent-apps.md)": "(/frontend/html/help.html#dependent-apps)",
    "(ntfy-notifications.md)": "(/frontend/html/help.html#ntfy-notifications)",
    "(home-assistant.md)": "(/frontend/html/help.html#home-assistant)",
    "(cron-triggers.md)": "(/frontend/html/help.html#cron-triggers)",
    "(install-app.md)": "(/frontend/html/help.html#install-app)",
}

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    for old, new in LINK_REPLACEMENTS.items():
        content = content.replace(old, new)
    
    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Updated: {os.path.basename(filepath)}")
    else:
        print(f"  No changes: {os.path.basename(filepath)}")

def main():
    print("Fixing help file links to use actual app URLs...")
    for fname in sorted(os.listdir(HELP_DIR)):
        if fname.endswith(".md"):
            process_file(os.path.join(HELP_DIR, fname))
    print("Done!")

if __name__ == "__main__":
    main()
