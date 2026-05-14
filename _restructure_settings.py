#!/usr/bin/env python3
"""Restructure settings.html to add Views and Collections tabs."""

import re

filepath = '/Users/cwhiii/Personal/Misc/Development/CWOC/src/frontend/html/settings.html'

with open(filepath, 'r') as f:
    content = f.read()

# Strategy: Replace the entire General tab section with reorganized content.
# The General tab currently runs from line with id="tab-general" to </div><!-- /tab-general -->

# Find the General tab content boundaries
gen_start_marker = '                <!-- ═══ General Tab ═══ -->\n                <div class="settings-tab-content active" id="tab-general">\n                <div class="settings-grid">'
gen_end_marker = '                </div><!-- /tab-general -->'

gen_start = content.find(gen_start_marker)
gen_end = content.find(gen_end_marker)

if gen_start == -1 or gen_end == -1:
    print(f"ERROR: Could not find General tab markers. start={gen_start}, end={gen_end}")
    exit(1)

# Extract the full general tab section (including markers)
gen_section = content[gen_start:gen_end + len(gen_end_marker)]

# Now let's find each setting-group within the general tab
# We need to extract them individually

# Helper: extract a setting-group by its h3 content
def extract_group(text, h3_pattern):
    """Extract a complete setting-group div containing the given h3 pattern."""
    # Find the h3
    h3_idx = text.find(h3_pattern)
    if h3_idx == -1:
        return None, text
    
    # Walk backwards to find the opening <div class="setting-group"
    # Look for the nearest preceding <div class="setting-group
    before_h3 = text[:h3_idx]
    div_start_options = [
        before_h3.rfind('<div class="setting-group">'),
        before_h3.rfind('<div class="setting-group" id='),
    ]
    div_start = max(d for d in div_start_options if d != -1)
    
    # Now find the matching closing </div> for this setting-group
    # Count nested divs
    search_start = div_start
    depth = 0
    i = search_start
    div_end = -1
    while i < len(text):
        if text[i:i+4] == '<div':
            depth += 1
            i += 4
        elif text[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                div_end = i + 6
                break
            i += 6
        else:
            i += 1
    
    if div_end == -1:
        return None, text
    
    group_html = text[div_start:div_end]
    # Remove from text
    remaining = text[:div_start] + text[div_end:]
    return group_html, remaining


# Extract the content between the grid opening and closing
grid_start = gen_start_marker
grid_content_start = gen_start + len(gen_start_marker) + 1  # +1 for newline
grid_content_end = gen_end  # before the tab closing

inner_content = content[grid_content_start:grid_content_end]

# Extract each group we need to move
# Groups to move to Views tab:
# - Time Periods (h3 contains "📅 Time Periods")
# - Custom Filters & Sorting
# - Omni View (has id="omni-view-settings")
# - Habits
# - Projects

# Groups to move to Collections tab:
# - Custom Colors
# - Tag Editor
# - Default Notifications
# - Saved Locations (part of Geography - we'll split Geography)

# Groups to keep in General:
# - General Settings
# - Display Options
# - Geography (map settings only)
# - Install as App

# Let's extract groups by finding their boundaries more reliably
# Each group starts with "                    <div class=\"setting-group" and ends with matching </div>

def split_groups(text):
    """Split text into individual setting-group blocks."""
    groups = []
    pattern = r'(\s*<div class="setting-group[^"]*"[^>]*>)'
    parts = re.split(pattern, text)
    
    current = ''
    for i, part in enumerate(parts):
        if re.match(pattern, part):
            if current.strip():
                groups.append(current)
            current = part
        else:
            current += part
    if current.strip():
        groups.append(current)
    
    return groups

# Actually, let me just use a simpler approach - find each group by its h3 text
# and track line positions

lines = content.split('\n')

# Find line indices for each group start
group_starts = []
for i, line in enumerate(lines):
    if '<div class="setting-group"' in line or '<div class="setting-group" id=' in line:
        # Check if this is inside the general tab (between gen_start and gen_end lines)
        line_pos = sum(len(l) + 1 for l in lines[:i])
        if gen_start <= line_pos < gen_end:
            group_starts.append(i)

print(f"Found {len(group_starts)} groups in General tab")
for gs in group_starts:
    # Print the h3 line
    for j in range(gs, min(gs+5, len(lines))):
        if '<h3>' in lines[j] or '<h3 ' in lines[j]:
            print(f"  Line {gs}: {lines[j].strip()}")
            break

# OK let me just do this with string manipulation on the full content
# I'll identify each group by unique markers and cut/paste them

# The approach: rebuild the section between tab-general start and tab-email start
# with the correct organization

# Find the email tab start
email_tab_marker = '                <!-- ═══ Email Tab ═══ -->'
email_tab_start = content.find(email_tab_marker)

# Everything before the general tab
before_general = content[:gen_start]

# Everything from email tab onwards
from_email = content[email_tab_start:]

# Now I need to build the middle section: General tab + Views tab + Collections tab

# Let me extract the inner HTML of each setting-group from the old general tab
old_general_inner = content[gen_start + len(gen_start_marker):gen_end]

# Split into groups by finding each <div class="setting-group
# Use regex to find all groups
group_pattern = re.compile(r'(\s*<div class="setting-group[^>]*>.*?</div>\s*(?=\s*<div class="setting-group|\s*</div><!-- /tab))', re.DOTALL)

# Actually this is getting complex. Let me just manually identify the boundaries.
# I know the exact h3 texts. Let me find each group's start and end.

def find_group_boundaries(text, h3_text):
    """Find start and end positions of a setting-group containing the given h3 text."""
    h3_pos = text.find(h3_text)
    if h3_pos == -1:
        print(f"  WARNING: Could not find h3: {h3_text}")
        return None, None
    
    # Walk back to find <div class="setting-group
    search_back = text[:h3_pos]
    # Find the last occurrence of the div opening
    candidates = []
    for m in re.finditer(r'<div class="setting-group[^>]*>', search_back):
        candidates.append(m.start())
    if not candidates:
        print(f"  WARNING: No setting-group div found before h3: {h3_text}")
        return None, None
    start = candidates[-1]
    
    # Find matching close - count div depth
    depth = 0
    i = start
    end = -1
    while i < len(text):
        if text[i:i+4] == '<div':
            depth += 1
            i += 4
        elif text[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                end = i + 6
                break
            i += 6
        else:
            i += 1
    
    return start, end

# Work within the general tab section only
gen_inner_start = gen_start + len(gen_start_marker) + 1
gen_inner_end = gen_end

gen_inner = content[gen_inner_start:gen_inner_end]

# Find each group within gen_inner
groups = {}
h3_markers = {
    'general_settings': '<h3>General Settings</h3>',
    'time_periods': '<h3>📅 Time Periods</h3>',
    'custom_filters': '<h3>Custom Filters &amp; Sorting</h3>',
    'display_options': '<h3>🎯 Display Options</h3>',
    'omni_view': '<h3>🔮 Omni View</h3>',
    'habits': '<h3>🔁 Habits</h3>',
    'projects': '<h3>📂 Projects</h3>',
    'geography': '<h3>🌍 Geography</h3>',
    'notifications': '<h3>🔔 Default Notifications</h3>',
    'colors': '<h3>🎨 Custom Colors</h3>',
    'tags': '<h3>🏷️ Tag Editor</h3>',
    'pwa': '<h3>📱 Install as App</h3>',
}

for key, h3 in h3_markers.items():
    start, end = find_group_boundaries(gen_inner, h3)
    if start is not None:
        groups[key] = gen_inner[start:end]
        print(f"  Found group '{key}': {len(groups[key])} chars")
    else:
        print(f"  MISSING group '{key}'")

# Now split the Geography group - keep map settings in General, move locations to Collections
geo_html = groups.get('geography', '')
if geo_html:
    # Find where "📍 Saved Locations" subheader starts
    loc_marker = '<label class="setting-subheader">📍 Saved Locations</label>'
    loc_pos = geo_html.find(loc_marker)
    if loc_pos != -1:
        # Geography for General: everything up to the locations subheader, then close the div
        geo_map_only = geo_html[:loc_pos].rstrip() + '\n                    </div>'
        
        # Locations for Collections: wrap in its own setting-group
        loc_content = geo_html[loc_pos:]
        # Remove the trailing </div> from loc_content (it's the group close)
        loc_content = loc_content.rstrip()
        if loc_content.endswith('</div>'):
            loc_content = loc_content[:-6].rstrip()
        
        geo_locations = '                    <div class="setting-group">\n                        <h3>📍 Saved Locations</h3>\n' + loc_content.replace(loc_marker, '').lstrip() + '\n                    </div>'
        
        groups['geography'] = geo_map_only
        groups['locations'] = geo_locations
        print(f"  Split geography: map={len(geo_map_only)}, locations={len(geo_locations)}")

# Build the new tabs
# General tab: general_settings, display_options, geography (map only), pwa
general_tab = '''                <!-- ═══ General Tab ═══ -->
                <div class="settings-tab-content active" id="tab-general">
                <div class="settings-grid">
''' + groups['general_settings'] + '\n' + groups['display_options'] + '\n' + groups['geography'] + '\n' + groups['pwa'] + '''
                </div>
                </div><!-- /tab-general -->

'''

# Views tab: time_periods (renamed Calendar), omni_view, habits, projects, custom_filters
# Rename "📅 Time Periods" to "📅 Calendar" in the time_periods group
time_periods_html = groups['time_periods'].replace('<h3>📅 Time Periods</h3>', '<h3>📅 Calendar</h3>')

views_tab = '''                <!-- ═══ Views Tab ═══ -->
                <div class="settings-tab-content" id="tab-views">
                <div class="settings-grid">
''' + time_periods_html + '\n' + groups['omni_view'] + '\n' + groups['habits'] + '\n' + groups['projects'] + '\n' + groups['custom_filters'] + '''
                </div>
                </div><!-- /tab-views -->

'''

# Collections tab: tags, colors, locations, notifications
collections_tab = '''                <!-- ═══ Collections Tab ═══ -->
                <div class="settings-tab-content" id="tab-collections">
                <div class="settings-grid">
''' + groups['tags'] + '\n' + groups['colors'] + '\n' + groups['locations'] + '\n' + groups['notifications'] + '''
                </div>
                </div><!-- /tab-collections -->

'''

# Assemble the full file
new_content = before_general + general_tab + views_tab + collections_tab + from_email

# Write it back
with open(filepath, 'w') as f:
    f.write(new_content)

print(f"\nDone! File rewritten ({len(new_content)} chars)")
