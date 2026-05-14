#!/usr/bin/env python3
"""
One-time script to merge individual release notes into daily collated files.
Each daily file: release_notes-YYYYMMDD.md
Format: reverse-chronological entries with ## version headers.
"""
import os
import re
import glob

NOTES_DIR = os.path.dirname(os.path.abspath(__file__))

# Collect all .md files (both naming patterns), skip this script and .rsls
all_files = []
for f in glob.glob(os.path.join(NOTES_DIR, "*.md")):
    basename = os.path.basename(f)
    if basename.startswith("_") or basename.startswith("release_notes-") and "." not in basename.replace("release_notes-", "").replace(".md", ""):
        continue  # skip daily files that already exist in new format (no time component)
    # Match both patterns: cwoc_release_YYYYMMDD.HHMM.md and release_notes-YYYYMMDD.HHMM.md
    m = re.match(r'(?:cwoc_release_|release_notes-)(\d{8})\.(\d{4})\.md$', basename)
    if not m:
        # Also match release_notes-YYYYMMDD.HHMM.md (with dash not underscore)
        m = re.match(r'(?:cwoc_release_|release_notes-)(\d{8})\.(\d{4})\.md$', basename)
    if m:
        date_part = m.group(1)
        time_part = m.group(2)
        version = f"{date_part}.{time_part}"
        all_files.append((date_part, time_part, version, f, basename))

# Group by date
from collections import defaultdict
by_date = defaultdict(list)
for date_part, time_part, version, filepath, basename in all_files:
    by_date[date_part].append((time_part, version, filepath, basename))

# Sort dates
sorted_dates = sorted(by_date.keys())

# For each date, create a collated file (reverse-chronological within the day)
for date in sorted_dates:
    entries = sorted(by_date[date], key=lambda x: x[0], reverse=True)  # newest first
    
    lines = []
    for time_part, version, filepath, basename in entries:
        # Read content
        with open(filepath, "r") as f:
            content = f.read().strip()
        
        # Strip existing header if present (e.g., "# CWOC Release 20260504.0636")
        content = re.sub(r'^#\s+CWOC Release \d{8}\.\d{4}\s*\n*', '', content).strip()
        
        # Add as a ## version entry
        lines.append(f"## {version}\n\n{content}")
    
    # Write daily file
    daily_filename = f"release_notes-{date}.md"
    daily_path = os.path.join(NOTES_DIR, daily_filename)
    
    with open(daily_path, "w") as f:
        f.write("\n\n".join(lines) + "\n")
    
    print(f"Created {daily_filename} ({len(entries)} entries)")

# Now delete all the individual files
deleted = 0
for date_part, time_part, version, filepath, basename in all_files:
    os.remove(filepath)
    deleted += 1

print(f"\nDeleted {deleted} individual files.")
print(f"Created {len(sorted_dates)} daily files.")
