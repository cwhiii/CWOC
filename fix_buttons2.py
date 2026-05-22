#!/usr/bin/env python3
"""
Second pass: Add colors parameter to Button() calls inside AlertDialog confirmButton blocks
that don't already have colors =.

Strategy: Find Button( calls inside confirmButton = { } blocks that don't have colors =,
and add the appropriate colors parameter.
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
                if 'AlertDialog(' in content and 'CwocDialogDefaults' in content:
                    results.append(path)
    return sorted(results)

def process_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    original = ''.join(lines)
    modified = False
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Find Button( that doesn't have colors = on the same line
        # and is inside an AlertDialog context (has CwocDialogDefaults nearby)
        if re.match(r'\s*Button\(\s*$', line) or (stripped.startswith('Button(') and 'colors =' not in line and ') {' not in line):
            # This is a multi-line Button( call. Find where it closes with ) {
            # and add colors = before the closing )
            j = i + 1
            paren_depth = 1  # inside Button(
            found_close = False
            is_danger = False
            
            while j < len(lines) and paren_depth > 0:
                jline = lines[j]
                jstripped = jline.strip()
                
                # Check for danger indicators
                if any(kw in jline for kw in ['Delete', 'Remove', 'Purge', 'DangerRed', 'Color.Red']):
                    is_danger = True
                
                for ci, ch in enumerate(jline):
                    if ch == '(': paren_depth += 1
                    elif ch == ')':
                        paren_depth -= 1
                        if paren_depth == 0:
                            # Found the closing ) of Button params
                            # Check if colors = is already in the Button params
                            block_text = ''.join(lines[i:j+1])
                            if 'colors =' not in block_text:
                                # Add colors parameter before the closing )
                                indent = len(jline) - len(jline.lstrip())
                                indent_str = ' ' * (indent + 4)
                                if is_danger:
                                    colors_line = f"{indent_str}colors = CwocDialogDefaults.dangerButtonColors(),\n"
                                else:
                                    colors_line = f"{indent_str}colors = CwocDialogDefaults.confirmButtonColors(),\n"
                                lines.insert(j, colors_line)
                                modified = True
                            found_close = True
                            break
                
                if found_close:
                    break
                j += 1
        
        i += 1
    
    if modified:
        with open(filepath, 'w') as f:
            f.writelines(lines)
    return modified

# Main
files = find_kt_files()
print(f"Processing {len(files)} files for multi-line Button colors...")
modified = 0
for f in files:
    if process_file(f):
        modified += 1
        print(f"  Fixed: {f.replace(BASE, '')}")

print(f"\nDone. Fixed {modified} files.")
