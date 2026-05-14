#!/usr/bin/env python3
"""Fix indentation issues in settings.html where setting-group divs lost their leading spaces."""

filepath = '/Users/cwhiii/Personal/Misc/Development/CWOC/src/frontend/html/settings.html'

with open(filepath, 'r') as f:
    content = f.read()

# Fix cases where <div class="setting-group starts at column 0 (no indentation)
# These should be indented with "                    " (20 spaces)
import re

# Pattern: line starts with <div class="setting-group (no leading whitespace)
# Replace with proper indentation
content = re.sub(
    r'\n<div class="setting-group([^>]*)>',
    r'\n                    <div class="setting-group\1>',
    content
)

with open(filepath, 'w') as f:
    f.write(content)

print("Fixed indentation")
