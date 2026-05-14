#!/usr/bin/env python3
"""Bulk cross-link documentation files — converts plain-text references to markdown links."""
import os
import re

DOCS_DIR = "/Users/cwhiii/Personal/Misc/Development/CWOC/documentation"

# Map of phrases to their link targets
# Format: (pattern, replacement_template)
# We use word-boundary-aware matching to avoid linking inside existing links
LINK_MAP = [
    # Views
    ("Omni View", "omni-view.md", "Omni View"),
    ("Calendar View", "calendar.md", "Calendar View"),
    ("Notes view", "notes.md", "Notes view"),
    ("Notes View", "notes.md", "Notes View"),
    ("Habits view", "habits.md", "Habits view"),
    ("Habits View", "habits.md", "Habits View"),
    ("Indicators view", "indicators.md", "Indicators view"),
    ("Indicators View", "indicators.md", "Indicators View"),
    ("Maps View", "maps.md", "Maps View"),
    ("Global Search", "global-search.md", "Global Search"),
    ("Tasks view", "views.md", "Tasks view"),
    ("Tasks View", "views.md", "Tasks View"),
    # Core
    ("Chit Editor", "editor.md", "Chit Editor"),
    ("chit editor", "editor.md", "chit editor"),
    ("Quick Edit modal", "quick-edit.md", "Quick Edit modal"),
    ("Quick Edit Modal", "quick-edit.md", "Quick Edit Modal"),
    ("Custom Objects", "custom-objects.md", "Custom Objects"),
    ("Audit Log", "audit-log.md", "Audit Log"),
    ("audit log", "audit-log.md", "audit log"),
    ("Rule Editor", "cron-triggers.md", "Rule Editor"),
    ("Rules Editor", "cron-triggers.md", "Rules Editor"),
    ("Weather page", "weather.md", "Weather page"),
    ("Weather Page", "weather.md", "Weather Page"),
    ("People page", "contacts.md", "People page"),
    ("contact editor", "contacts.md", "contact editor"),
    ("Contact Editor", "contacts.md", "Contact Editor"),
    ("Data Management", "data-management.md", "Data Management"),
]

def should_skip_line(line):
    """Skip headings, 'See also' lines, and lines that are just the title."""
    stripped = line.strip()
    if stripped.startswith("#"):
        return True
    if "See also" in stripped:
        return True
    return False

def link_file(filepath):
    """Process a single file, adding cross-links."""
    filename = os.path.basename(filepath)
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    lines = content.split("\n")
    new_lines = []
    
    for line in lines:
        if should_skip_line(line):
            new_lines.append(line)
            continue
        
        for phrase, target, display in LINK_MAP:
            # Don't link to self
            if target == filename:
                continue
            
            # Don't link if already linked (check for [phrase] pattern nearby)
            # Use a regex that matches the phrase but NOT when it's already inside []
            # or when it's part of a markdown link target
            
            # Pattern: match the phrase when NOT preceded by [ or followed by ]( 
            # and NOT already inside a markdown link
            def replace_if_not_linked(match):
                start = match.start()
                # Check if inside a markdown link: look backwards for [ without ]
                before = line[:start]
                # Count unmatched [ 
                open_brackets = before.count("[") - before.count("]")
                if open_brackets > 0:
                    return match.group(0)  # Inside a link, don't replace
                # Check if preceded by ]( — this is a link target
                if before.rstrip().endswith("]("):
                    return match.group(0)
                return "[" + display + "](" + target + ")"
            
            # Only replace first occurrence per line to avoid over-linking
            pattern = r'(?<!\[)' + re.escape(phrase) + r'(?!\]\()'
            new_line = re.sub(pattern, replace_if_not_linked, line, count=1)
            if new_line != line:
                line = new_line
        
        new_lines.append(line)
    
    new_content = "\n".join(new_lines)
    
    if new_content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"  Updated: {filename}")
    else:
        print(f"  No changes: {filename}")

def main():
    print("Cross-linking documentation files...")
    for fname in sorted(os.listdir(DOCS_DIR)):
        if fname.endswith(".md"):
            link_file(os.path.join(DOCS_DIR, fname))
    print("Done!")

if __name__ == "__main__":
    main()
