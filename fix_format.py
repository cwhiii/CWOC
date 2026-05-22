#!/usr/bin/env python3
"""
Fix formatting issues where colors = CwocDialogDefaults... ended up on a line starting with comma.
Pattern: 
    someParam = value\n
    , colors = CwocDialogDefaults.xxxButtonColors()) {

Should be:
    someParam = value,
    colors = CwocDialogDefaults.xxxButtonColors()
    ) {

Or better yet, merge into the previous line:
    someParam = value, colors = CwocDialogDefaults.xxxButtonColors()) {
"""
import os
import re

BASE = "/Users/cwhiii/Personal/Misc/Development/CWOC/android/app/src/main/java/com/cwoc/app"

def find_files():
    results = []
    for root, dirs, files in os.walk(BASE):
        for f in files:
            if f.endswith('.kt'):
                path = os.path.join(root, f)
                with open(path, 'r') as fh:
                    content = fh.read()
                if ', colors = CwocDialogDefaults' in content:
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
        
        # Pattern: line starts with ", colors = CwocDialogDefaults..."
        if stripped.startswith(', colors = CwocDialogDefaults'):
            # Merge with previous line
            if i > 0:
                prev = lines[i-1].rstrip('\n')
                # The current line has ", colors = ...) {" or similar
                # Append to previous line
                lines[i-1] = prev + stripped + '\n'
                lines.pop(i)
                modified = True
                continue  # Don't increment i since we removed a line
        
        i += 1
    
    if modified:
        with open(filepath, 'w') as f:
            f.writelines(lines)
    return modified

# Also fix the dismiss button issue in CwocPromptDialog
def fix_dismiss_cancel_buttons(filepath):
    """Remove colors from dismiss/cancel buttons that shouldn't have them."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern: TextButton(onClick = onDismiss, colors = CwocDialogDefaults.confirmButtonColors()) {\n    Text(cancelLabel)
    # or: TextButton(onClick = { ... }, colors = ...) { Text("Cancel") }
    # These should not have colors
    
    # Find TextButton lines with colors that have Cancel/Close/Dismiss text nearby
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'colors = CwocDialogDefaults' in line and 'TextButton(' in line:
            # Check if this is a cancel button
            for j in range(i, min(i + 3, len(lines))):
                if 'cancelLabel' in lines[j] or 'Text("Cancel"' in lines[j] or 'Text("Close"' in lines[j] or 'Text("Dismiss"' in lines[j]:
                    # Remove the colors parameter
                    line_new = re.sub(r',\s*colors\s*=\s*CwocDialogDefaults\.\w+ButtonColors\(\)', '', line)
                    lines[i] = line_new
                    break
    
    content = '\n'.join(lines)
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Main
files = find_files()
print(f"Fixing formatting in {len(files)} files...")
modified = 0
for f in files:
    if process_file(f):
        modified += 1
        print(f"  Fixed format: {f.replace(BASE, '')}")

print(f"\nFixed formatting in {modified} files.")

# Now fix cancel button colors
print("\nFixing cancel button colors...")
all_kt = []
for root, dirs, files in os.walk(BASE):
    for f in files:
        if f.endswith('.kt'):
            path = os.path.join(root, f)
            with open(path, 'r') as fh:
                if 'colors = CwocDialogDefaults' in fh.read():
                    all_kt.append(path)

cancel_fixed = 0
for f in sorted(all_kt):
    if fix_dismiss_cancel_buttons(f):
        cancel_fixed += 1
        print(f"  Fixed cancel: {f.replace(BASE, '')}")

print(f"\nFixed cancel buttons in {cancel_fixed} files.")
