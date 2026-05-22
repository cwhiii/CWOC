#!/usr/bin/env python3
"""
Fix multi-line title blocks in AlertDialogs to use CwocDialogDefaults.titleStyle.
This handles cases where title = { spans multiple lines with a Text() composable.
"""
import os
import re

BASE = "/Users/cwhiii/Personal/Misc/Development/CWOC/android/app/src/main/java/com/cwoc/app"

def find_kt_files_with_alert_dialog():
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
    
    # Find AlertDialog blocks and their multi-line title sections
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Look for AlertDialog( 
        if re.search(r'\bAlertDialog\s*\(', stripped) and not stripped.startswith('//'):
            # We're inside an AlertDialog. Find the title = { block
            # Scan forward to find title = { that's on its own line (multi-line case)
            ad_start = i
            paren_depth = 0
            # Count parens to find end of AlertDialog
            for ch in line[line.find('AlertDialog('):]:
                if ch == '(': paren_depth += 1
                elif ch == ')': paren_depth -= 1
            
            j = i + 1
            while j < len(lines) and paren_depth > 0:
                for ch in lines[j]:
                    if ch == '(': paren_depth += 1
                    elif ch == ')':
                        paren_depth -= 1
                        if paren_depth == 0: break
                
                # Check if this line starts a multi-line title block
                jstripped = lines[j].strip()
                if jstripped.startswith('title = {') and 'CwocDialogDefaults.titleStyle' not in lines[j]:
                    # Check if the title = { is on its own line (multi-line block)
                    if jstripped == 'title = {' or jstripped == 'title = { ':
                        # Multi-line title block. Find the Text() inside it.
                        # Look at the next few lines for Text(
                        k = j + 1
                        brace_depth = 1
                        while k < len(lines) and brace_depth > 0:
                            kline = lines[k]
                            kstripped = kline.strip()
                            
                            for ch in kline:
                                if ch == '{': brace_depth += 1
                                elif ch == '}': brace_depth -= 1
                            
                            # If we find a Text( call, add style = CwocDialogDefaults.titleStyle
                            if 'Text(' in kstripped and 'style =' not in kstripped and brace_depth > 0:
                                # Find the Text( and add style parameter
                                # Check if Text closes on this line
                                text_pos = kline.find('Text(')
                                if text_pos >= 0:
                                    # Count parens from Text(
                                    tp = 0
                                    text_end = -1
                                    for ci in range(text_pos + 4, len(kline)):
                                        if kline[ci] == '(': tp += 1
                                        elif kline[ci] == ')':
                                            tp -= 1
                                            if tp == 0:
                                                text_end = ci
                                                break
                                    
                                    if text_end > 0:
                                        # Single-line Text() - add style before closing paren
                                        inner = kline[text_pos + 5:text_end]
                                        # Remove fontWeight = FontWeight.Bold
                                        inner = re.sub(r',?\s*fontWeight\s*=\s*FontWeight\.Bold', '', inner)
                                        inner = re.sub(r'fontWeight\s*=\s*FontWeight\.Bold\s*,?\s*', '', inner)
                                        # Remove color params
                                        inner = re.sub(r',?\s*color\s*=\s*Color\(0xFF[0-9A-Fa-f]+\)', '', inner)
                                        inner = re.sub(r'color\s*=\s*Color\(0xFF[0-9A-Fa-f]+\)\s*,?\s*', '', inner)
                                        inner = re.sub(r',?\s*color\s*=\s*ParchmentText', '', inner)
                                        inner = re.sub(r'color\s*=\s*ParchmentText\s*,?\s*', '', inner)
                                        inner = inner.strip().rstrip(',').strip()
                                        
                                        if inner:
                                            new_text = f"Text({inner}, style = CwocDialogDefaults.titleStyle)"
                                        else:
                                            new_text = f"Text(style = CwocDialogDefaults.titleStyle)"
                                        lines[k] = kline[:text_pos] + new_text + kline[text_end + 1:]
                                        modified = True
                                    else:
                                        # Multi-line Text() - look for the closing paren
                                        # Find where Text() ends and add style there
                                        # Look for lines with just parameters until we find the closing )
                                        # Add style = CwocDialogDefaults.titleStyle before the closing )
                                        m = k + 1
                                        text_paren = 1  # we're inside Text(
                                        while m < len(lines):
                                            mline = lines[m]
                                            for ci, ch in enumerate(mline):
                                                if ch == '(': text_paren += 1
                                                elif ch == ')':
                                                    text_paren -= 1
                                                    if text_paren == 0:
                                                        # This line has the closing ) of Text
                                                        # Add style before this line
                                                        indent = len(mline) - len(mline.lstrip())
                                                        # Check if this line is just ")" or has content
                                                        mstripped = mline.strip()
                                                        if mstripped == ')' or mstripped == '),':
                                                            # Insert style line before closing paren
                                                            style_indent = ' ' * (indent + 4)
                                                            # But first check if there's already a style
                                                            # Look at lines between k and m for existing style/fontWeight/color to remove
                                                            for rm_idx in range(k + 1, m):
                                                                rm_line = lines[rm_idx].strip()
                                                                if rm_line.startswith('fontWeight = FontWeight.Bold'):
                                                                    lines[rm_idx] = ''
                                                                    modified = True
                                                                elif rm_line.startswith('color = Color(0xFF'):
                                                                    lines[rm_idx] = ''
                                                                    modified = True
                                                                elif rm_line.startswith('color = ParchmentText'):
                                                                    lines[rm_idx] = ''
                                                                    modified = True
                                                            # Add style parameter
                                                            style_line = f"{style_indent}style = CwocDialogDefaults.titleStyle,\n"
                                                            lines.insert(m, style_line)
                                                            modified = True
                                                        break
                                            if text_paren == 0:
                                                break
                                            m += 1
                                break  # Only handle first Text in title block
                            k += 1
                
                if paren_depth == 0:
                    break
                j += 1
            i = j + 1
        else:
            i += 1
    
    content = ''.join(lines)
    # Clean up empty lines from removed fontWeight/color
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Main
files = find_kt_files_with_alert_dialog()
print(f"Processing {len(files)} files for multi-line title fixes...")
modified = 0
for f in files:
    if process_file(f):
        modified += 1
        print(f"  Fixed: {f.replace(BASE, '')}")

print(f"\nDone. Fixed {modified} files.")
