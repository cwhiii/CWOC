#!/usr/bin/env python3
"""
Script to apply CwocDialogDefaults theming to all AlertDialog usages.
Changes:
1. Add/replace containerColor with CwocDialogDefaults.containerColor
2. Add modifier = CwocDialogDefaults.borderModifier
3. Update title Text to use style = CwocDialogDefaults.titleStyle
4. Update confirm TextButton to use Button with colors = CwocDialogDefaults.confirmButtonColors()
5. Update danger/delete TextButton to use Button with colors = CwocDialogDefaults.dangerButtonColors()
6. Add import for CwocDialogDefaults
"""
import os
import re
import glob

BASE = "/Users/cwhiii/Personal/Misc/Development/CWOC/android/app/src/main/java/com/cwoc/app"

# Find all .kt files with AlertDialog(
files_with_dialog = []
for root, dirs, files in os.walk(BASE):
    for f in files:
        if f.endswith('.kt') and f != '_fix_dialogs.py':
            path = os.path.join(root, f)
            with open(path, 'r') as fh:
                content = fh.read()
            if 'AlertDialog(' in content:
                files_with_dialog.append(path)

print(f"Found {len(files_with_dialog)} files with AlertDialog")
for f in sorted(files_with_dialog):
    print(f"  {f.replace(BASE, '')}")
