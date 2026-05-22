#!/usr/bin/env python3
"""
Fix missing commas before 'colors = CwocDialogDefaults' lines.
The previous script inserted colors = lines but didn't ensure the preceding line has a trailing comma.
"""
import os
import re

BASE = "/Users/cwhiii/Personal/Misc/Development/CWOC/android/app/src/main/java/com/cwoc/app"

def find_kt_files():
    results = []
    for root, dirs, files in os.walk(BASE):
        for f in files:
            if f.endswith('.kt'):
                path = os.path.join(root, f)
                with open(path, 'r') as fh:
                    content = fh.read()
                if 'colors = CwocDialogDefaults' in content:
                    results.append(path)
    return sorted(results)

def process_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    original = ''.join(lines)
    modified = False
    
    for i in range(1, len(lines)):
        line = lines[i]
        stripped = line.strip()
        
        # If this line is a colors = CwocDialogDefaults line
        if stripped.startswith('colors = CwocDialogDefaults.'):
            # Check if the previous line ends with a comma (ignoring whitespace)
            prev_line = lines[i-1].rstrip('\n')
            prev_stripped = prev_line.rstrip()
            if prev_stripped and not prev_stripped.endswith(',') and not prev_stripped.endswith('(') and not prev_stripped.endswith('{'):
                # Add comma to end of previous line
                lines[i-1] = prev_stripped + ',\n'
                modified = True
            
            # Also fix: if this colors line has a trailing comma followed by ) on next line,
            # remove the trailing comma (it should be the last param before ))
            if stripped.endswith(','):
                # Check if next line is ) { or just )
                if i + 1 < len(lines):
                    next_stripped = lines[i+1].strip()
                    if next_stripped.startswith(')'):
                        # Remove trailing comma from colors line
                        lines[i] = line.rstrip('\n').rstrip().rstrip(',') + '\n'
                        modified = True
    
    if modified:
        with open(filepath, 'w') as f:
            f.writelines(lines)
    return modified

# Main
files = find_kt_files()
print(f"Processing {len(files)} files for comma fixes...")
modified = 0
for f in files:
    if process_file(f):
        modified += 1
        print(f"  Fixed: {f.replace(BASE, '')}")

print(f"\nDone. Fixed {modified} files.")
