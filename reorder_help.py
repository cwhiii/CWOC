#!/usr/bin/env python3
"""Reorder help.html body sections without changing any content."""

import re

with open('src/frontend/html/help.html', 'r') as f:
    lines = f.readlines()

# Section start lines (0-indexed): each h3 tag
# We need to identify sections by their h3 id
section_starts = []
for i, line in enumerate(lines):
    m = re.search(r'<h3\s+id="([^"]*)"', line)
    if m:
        section_starts.append((i, m.group(1)))

# Build a dict of section_id -> (start_line_idx, end_line_idx_exclusive)
sections = {}
for idx, (start, sid) in enumerate(section_starts):
    if idx + 1 < len(section_starts):
        end = section_starts[idx + 1][0]
    else:
        # Last section ends before the closing </div> tags
        # Find the first </div> after the last h3
        end = start + 1
        while end < len(lines) and not (lines[end].strip().startswith('</div>') and end > start + 5):
            end += 1
    sections[sid] = (start, end)

# Special case: "mobile" should be grouped with "mouse"
# So "mouse" section extends through "mobile" section
mouse_start = sections['mouse'][0]
mobile_end = sections['mobile'][1]
sections['mouse'] = (mouse_start, mobile_end)
# Remove mobile as a standalone section
del sections['mobile']

# Verify all sections
print("Sections found:")
for sid, (s, e) in sections.items():
    print(f"  {sid}: lines {s+1}-{e} ({e-s} lines)")

# The header (before first h3) is lines 0..68 (0-indexed)
# The footer (closing divs + scripts) starts at line 797 (0-indexed)
header_end = section_starts[0][0]  # line 69 (0-indexed = 68)
# Find the closing </div> after all sections
# The last section's content ends, then we have </div></div> and scripts
last_section_end = max(e for s, e in sections.values())

# Find footer start - it's the </div> lines after all content
footer_start = last_section_end
print(f"\nHeader: lines 1-{header_end} (0-indexed 0-{header_end-1})")
print(f"Footer starts at line {footer_start+1} (0-indexed {footer_start})")
print(f"Footer content: {lines[footer_start].rstrip()}")

# New order - VIEWS first, then REFERENCE
views_order = [
    'views',          # Views & Tabs
    'calendar',       # Calendar View
    'notes-view',     # Notes View
    'habits-view',    # Habits
    'maps-view',      # Maps View
    'email',          # Email
    'global-search',  # Global Search
    'trash',          # Trash
    'kiosk',          # Kiosk
]

reference_order = [
    'what-is-cwoc',      # What is CWOC
    'chits',             # Chits
    'editor',            # Chit Editor
    'quick-edit',        # Quick Edit
    'mouse',             # Mouse Interactions + Mobile Touch
    'hotkeys',           # Keyboard Shortcuts
    'recurrence',        # Recurrence
    'tags',              # Tags
    'filters',           # Filtering & Sorting
    'contacts',          # Contact Editor
    'sharing',           # Sharing
    'attachments',       # Attachments
    'clocks',            # Clocks
    'weather',           # Weather
    'saved-locations',   # Saved Locations
    'alert-indicators',  # Visual Indicators
    'calculator',        # Calculator
    'settings',          # Settings
    'data-management',   # Data Management (includes calendar-import h4)
    'audit-log',         # Audit Log
    'version-management',# Version Management
    'network-access',    # Network Access
    'ntfy-notifications',# Ntfy Notifications
    'install-app',       # Install as App
]

# Verify all sections are accounted for
all_ids = set(sections.keys())
new_ids = set(views_order + reference_order)
print(f"\nAll section IDs: {sorted(all_ids)}")
print(f"New order IDs: {sorted(new_ids)}")
if all_ids != new_ids:
    print(f"MISSING from new order: {all_ids - new_ids}")
    print(f"EXTRA in new order: {new_ids - all_ids}")
else:
    print("All sections accounted for!")

# Build the new file
output = []

# Header (everything before first h3)
output.extend(lines[:header_end])

# Views separator comment
output.append('            <!-- ═══ VIEWS ═══════════════════════════════════════════════════════ -->\n')

# Views sections
for sid in views_order:
    s, e = sections[sid]
    output.extend(lines[s:e])

# Reference separator comment
output.append('            <!-- ═══ REFERENCE ══════════════════════════════════════════════════ -->\n')

# Reference sections
for sid in reference_order:
    s, e = sections[sid]
    output.extend(lines[s:e])

# Footer
output.extend(lines[footer_start:])

# Write the result
with open('src/frontend/html/help.html', 'w') as f:
    f.writelines(output)

print(f"\nDone! New file has {len(output)} lines (was {len(lines)} lines)")
print(f"Added 2 comment lines, so expected {len(lines) + 2} lines")
