#!/usr/bin/env python3
"""
Add colors parameter to TextButton calls inside AlertDialog confirmButton blocks.
Properly handles Kotlin lambda syntax where onClick = { ... } is inside the parens.

The key pattern is:
  TextButton(onClick = { ... }) { Text("...") }
  
We need to insert colors = ... BEFORE the closing ) of TextButton's params,
which comes AFTER the } of the onClick lambda.
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

def find_textbutton_close_paren(lines, start_line, start_col):
    """
    Given the position of TextButton( (start_line, start_col points to the '(' ),
    find the line and column of the matching ')' that closes TextButton's parameters.
    
    This properly handles nested lambdas { } inside the parens.
    In Kotlin, { } inside () are just content - they don't affect paren depth.
    But we need to track brace depth to know when we're inside a lambda vs outside.
    
    Actually, for paren matching, we just count ( and ) regardless of braces.
    The ) that brings us back to depth 0 is the one we want.
    """
    paren_depth = 0
    line_idx = start_line
    col_idx = start_col
    
    # Start from the ( character
    for ci in range(col_idx, len(lines[line_idx])):
        ch = lines[line_idx][ci]
        if ch == '(':
            paren_depth += 1
        elif ch == ')':
            paren_depth -= 1
            if paren_depth == 0:
                return line_idx, ci
    
    # Continue on subsequent lines
    for li in range(line_idx + 1, len(lines)):
        for ci in range(len(lines[li])):
            ch = lines[li][ci]
            if ch == '(':
                paren_depth += 1
            elif ch == ')':
                paren_depth -= 1
                if paren_depth == 0:
                    return li, ci
    
    return -1, -1

def is_danger_button(lines, start, end):
    """Check if a button is a danger/delete button."""
    for i in range(start, min(end + 1, len(lines))):
        line = lines[i]
        if any(kw in line for kw in ['color = DangerRed', 'color = Color.Red', 'color = androidx.compose.ui.graphics.Color.Red']):
            return True
        if re.search(r'Text\("[^"]*[Dd]elete', line):
            return True
        if re.search(r'Text\("[^"]*[Rr]emove', line):
            return True
        if re.search(r'Text\("[^"]*[Pp]urge', line):
            return True
        if re.search(r'Text\("🗑️', line):
            return True
        # Also check for "Delete" as standalone
        if '"Delete"' in line or '"Delete Series"' in line or '"Delete Tag"' in line:
            return True
    return False

def is_cancel_button(lines, start, end):
    """Check if a button is a cancel/close/dismiss button."""
    for i in range(start, min(end + 1, len(lines))):
        line = lines[i]
        if re.search(r'Text\("Cancel"', line):
            return True
        if re.search(r'Text\("Close"', line):
            return True
        if re.search(r'Text\("Dismiss"', line):
            return True
        if re.search(r'Text\("No"', line):
            return True
        if re.search(r'Text\("Not now"', line):
            return True
        if re.search(r'Text\("Later"', line):
            return True
        if re.search(r'Text\("Back"', line):
            return True
    return False

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    lines = content.split('\n')
    
    # Find all AlertDialog blocks and process buttons within them
    # We need to process from bottom to top to avoid index shifting
    
    # First, find all TextButton( positions inside AlertDialog confirmButton blocks
    insertions = []  # list of (line, col, colors_str) to insert
    
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        
        if re.search(r'\bAlertDialog\s*\(', stripped) and not stripped.startswith('//'):
            # Find AlertDialog extent
            ad_pos = lines[i].find('AlertDialog(')
            ad_end_line, _ = find_textbutton_close_paren(lines, i, ad_pos + len('AlertDialog') )
            if ad_end_line < 0:
                i += 1
                continue
            
            # Within this AlertDialog, find confirmButton and dismissButton sections
            j = i + 1
            in_confirm = False
            in_dismiss = False
            section_brace_depth = 0
            
            while j <= ad_end_line:
                jstripped = lines[j].strip()
                
                # Detect section starts
                if re.match(r'confirmButton\s*=\s*\{', jstripped) or 'confirmButton = {' in jstripped:
                    in_confirm = True
                    in_dismiss = False
                    section_brace_depth = sum(1 for c in lines[j] if c == '{') - sum(1 for c in lines[j] if c == '}')
                elif re.match(r'dismissButton\s*=\s*\{', jstripped) or 'dismissButton = {' in jstripped:
                    in_dismiss = True
                    in_confirm = False
                    section_brace_depth = sum(1 for c in lines[j] if c == '{') - sum(1 for c in lines[j] if c == '}')
                elif in_confirm or in_dismiss:
                    section_brace_depth += sum(1 for c in lines[j] if c == '{') - sum(1 for c in lines[j] if c == '}')
                    if section_brace_depth <= 0:
                        in_confirm = False
                        in_dismiss = False
                
                # Find TextButton( in confirm or dismiss sections
                if (in_confirm or in_dismiss) and 'TextButton(' in jstripped and 'colors =' not in lines[j]:
                    tb_pos = lines[j].find('TextButton(')
                    paren_start = tb_pos + len('TextButton')
                    
                    # Find the closing ) of TextButton
                    close_line, close_col = find_textbutton_close_paren(lines, j, paren_start)
                    
                    if close_line >= 0:
                        # Determine button type
                        search_end = min(close_line + 3, ad_end_line)
                        danger = is_danger_button(lines, j, search_end)
                        cancel = is_cancel_button(lines, j, search_end)
                        
                        if cancel and not danger:
                            pass  # Don't add colors to cancel buttons
                        else:
                            colors_str = 'colors = CwocDialogDefaults.dangerButtonColors()' if danger else 'colors = CwocDialogDefaults.confirmButtonColors()'
                            insertions.append((close_line, close_col, colors_str))
                
                j += 1
            
            i = ad_end_line + 1
        else:
            i += 1
    
    # Apply insertions from bottom to top
    insertions.sort(key=lambda x: (x[0], x[1]), reverse=True)
    
    for line_idx, col_idx, colors_str in insertions:
        line = lines[line_idx]
        # Insert ", colors_str" before the ) at col_idx
        # Check what's before the )
        before = line[:col_idx]
        after = line[col_idx:]  # starts with )
        
        # If the char before ) is }, we need ", colors_str" between } and )
        # Pattern: ...}) { → ..., colors_str) {
        before_stripped = before.rstrip()
        if before_stripped.endswith('}') or before_stripped.endswith(','):
            if before_stripped.endswith(','):
                # Already has comma, just add space + colors
                lines[line_idx] = before + ' ' + colors_str + after
            else:
                # Add comma after }
                lines[line_idx] = before_stripped + ', ' + colors_str + after
        elif before_stripped.endswith('('):
            # Empty params (unlikely for TextButton)
            lines[line_idx] = before + colors_str + after
        else:
            # Some other content before )
            lines[line_idx] = before_stripped + ', ' + colors_str + after
    
    content = '\n'.join(lines)
    
    # Remove explicit red color from Text inside danger buttons
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*DangerRed\)', r'\1)', content)
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*Color\.Red\)', r'\1)', content)
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*androidx\.compose\.ui\.graphics\.Color\.Red\)', r'\1)', content)
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*Color\(0xFF8B5A2B\)\)', r'\1)', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Main
files = find_kt_files()
print(f"Processing {len(files)} files for button colors...")
modified = 0
for f in files:
    if process_file(f):
        modified += 1
        print(f"  Modified: {f.replace(BASE, '')}")

print(f"\nDone. Modified {modified} files.")
