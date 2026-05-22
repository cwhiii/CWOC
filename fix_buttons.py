#!/usr/bin/env python3
"""
Update confirm and danger buttons in AlertDialogs to use CwocDialogDefaults button colors.

Strategy:
- Find confirmButton = { TextButton(...) { Text("...") } } patterns
- Convert TextButton to Button with colors = CwocDialogDefaults.confirmButtonColors()
- Find danger/delete buttons (text contains "Delete", "Remove", color = Red/DangerRed)
- Convert those to Button with colors = CwocDialogDefaults.dangerButtonColors()
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
        content = f.read()
    
    original = content
    
    # Strategy: Find TextButton calls inside confirmButton = { } blocks of AlertDialogs
    # and convert them to Button with appropriate colors.
    # 
    # Pattern 1 (confirm): TextButton(onClick = { ... }) { Text("Confirm/Save/OK/Close/etc") }
    # → Button(onClick = { ... }, colors = CwocDialogDefaults.confirmButtonColors()) { Text("...") }
    #
    # Pattern 2 (danger): TextButton(onClick = { ... }) { Text("Delete...", color = Red/DangerRed) }
    # → Button(onClick = { ... }, colors = CwocDialogDefaults.dangerButtonColors()) { Text("...") }
    
    # For simplicity and safety, let's do targeted replacements:
    # 1. In confirmButton blocks: replace TextButton( with Button( and add colors param
    # 2. In dismissButton blocks with danger text: same but with dangerButtonColors
    
    # Actually, let's be more surgical. The key patterns are:
    # - confirmButton TextButtons that are NOT danger → confirmButtonColors
    # - Any TextButton with "Delete" text or color = Red/DangerRed → dangerButtonColors
    
    # Let's find lines with TextButton inside AlertDialog contexts and check the Text content
    lines = content.split('\n')
    result = []
    i = 0
    in_alert_dialog = 0  # depth counter
    in_confirm_button = False
    in_dismiss_button = False
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Track AlertDialog depth
        if re.search(r'\bAlertDialog\s*\(', stripped) and not stripped.startswith('//'):
            in_alert_dialog += 1
        
        # Track confirmButton/dismissButton blocks
        if in_alert_dialog > 0:
            if stripped.startswith('confirmButton = {') or stripped.startswith('confirmButton ='):
                in_confirm_button = True
            elif stripped.startswith('dismissButton = {') or stripped.startswith('dismissButton ='):
                in_dismiss_button = True
        
        # Look for TextButton patterns to convert
        if in_alert_dialog > 0 and 'TextButton(' in stripped:
            # Check if this is a danger button by looking at the Text content nearby
            # Look ahead a few lines for the Text() content
            is_danger = False
            text_content = ""
            for lookahead in range(i, min(i + 5, len(lines))):
                la_line = lines[lookahead]
                if 'color = DangerRed' in la_line or 'color = Color.Red' in la_line or 'color = androidx.compose.ui.graphics.Color.Red' in la_line:
                    is_danger = True
                # Check for danger keywords in Text content
                text_match = re.search(r'Text\("([^"]*)"', la_line)
                if text_match:
                    text_content = text_match.group(1)
                    if any(kw in text_content.lower() for kw in ['delete', 'remove', 'purge', 'destroy']):
                        is_danger = True
            
            # Also check if the text says "Delete Series" or similar
            if 'Delete' in stripped or '"Delete' in stripped:
                is_danger = True
            
            # Convert TextButton to Button with colors
            if is_danger:
                # Replace TextButton( with Button( and add colors
                new_line = line.replace('TextButton(', 'Button(')
                # Add colors parameter after onClick = { ... }
                # Find the closing ) of the onClick lambda or enabled param
                # Simple approach: add colors before the closing ) of Button params
                # Actually, let's just add it after the TextButton→Button replacement
                # We need to find where to insert colors =
                
                # Pattern: Button(onClick = { ... }) { or Button(\n    onClick = { ... },\n    enabled = ...\n) {
                # Let's add colors right before the closing ) {
                result.append(new_line)
            elif in_confirm_button and not is_danger:
                # This is a confirm button - add confirmButtonColors
                new_line = line.replace('TextButton(', 'Button(')
                result.append(new_line)
            else:
                # Dismiss/cancel button - leave as TextButton (no special styling needed for cancel)
                result.append(line)
            i += 1
            continue
        
        # Track closing braces to exit confirmButton/dismissButton blocks
        if in_confirm_button or in_dismiss_button:
            # Simple heuristic: if we see another top-level parameter, we've exited
            if stripped.startswith('dismissButton =') and in_confirm_button:
                in_confirm_button = False
                in_dismiss_button = True
            elif stripped.startswith('confirmButton =') and in_dismiss_button:
                in_dismiss_button = False
                in_confirm_button = True
            elif stripped.startswith('containerColor') or stripped.startswith('modifier =') or stripped == ')':
                in_confirm_button = False
                in_dismiss_button = False
        
        # Track AlertDialog closing
        if in_alert_dialog > 0 and stripped == ')':
            # This might be the AlertDialog closing - rough heuristic
            pass
        
        result.append(line)
        i += 1
    
    content = '\n'.join(result)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Actually, the above approach is too complex and error-prone.
# Let me take a simpler approach: just add colors to the TextButton→Button conversion
# by doing a regex replacement on the specific patterns.

def process_file_v2(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern: Inside AlertDialog confirmButton blocks, convert TextButton to Button with confirmButtonColors
    # Pattern: For danger buttons (with Delete/Remove text or red color), use dangerButtonColors
    
    # Approach: Find all TextButton calls that are inside AlertDialog blocks
    # and have danger indicators, replace with Button + dangerButtonColors
    
    # Step 1: Replace danger TextButtons (those with "Delete" text and red color)
    # Pattern: TextButton(onClick = { ... }) {\n    Text("Delete...", color = ...)  }
    # These often have: Text("Delete...", color = DangerRed) or Text("Delete...", color = Color.Red)
    
    # Remove color = DangerRed/Color.Red from Text inside danger buttons
    # and convert TextButton to Button with dangerButtonColors
    
    # For now, let's just do the color parameter additions to existing TextButton calls
    # since converting TextButton to Button changes the visual appearance significantly
    # (Button has a filled background, TextButton is just text)
    
    # Actually, per the task requirements, we want:
    # - Confirm buttons: colors = CwocDialogDefaults.confirmButtonColors() 
    # - Danger buttons: colors = CwocDialogDefaults.dangerButtonColors()
    # These should be Button (filled) not TextButton (text-only)
    
    # Let's do a simpler approach: just find and replace specific patterns
    
    # For danger buttons with explicit red color:
    # TextButton(onClick = { ... }) { Text("Delete...", color = DangerRed) }
    # → Button(onClick = { ... }, colors = CwocDialogDefaults.dangerButtonColors()) { Text("Delete...") }
    
    # This is getting complex. Let me just handle the color removal from Text inside buttons
    # and add colors to the Button/TextButton calls.
    
    # Simplest reliable approach: 
    # 1. Find TextButton lines inside confirmButton = { } that don't have "Cancel" text
    # 2. Add colors = CwocDialogDefaults.confirmButtonColors() to them
    # 3. Find TextButton lines with danger text, add colors = CwocDialogDefaults.dangerButtonColors()
    
    # Actually the simplest approach that works: just convert TextButton to Button
    # and add the colors parameter. Let me do this line by line with context awareness.
    
    lines = content.split('\n')
    result = lines[:]  # copy
    
    # Find all AlertDialog blocks
    i = 0
    while i < len(result):
        line = result[i]
        stripped = line.strip()
        
        if re.search(r'\bAlertDialog\s*\(', stripped) and not stripped.startswith('//'):
            # Found AlertDialog. Find its confirmButton and dismissButton sections
            # Track brace depth from AlertDialog(
            ad_start = i
            depth = 0
            for ch in line[line.find('AlertDialog(') + len('AlertDialog(') - 1:]:
                if ch == '(': depth += 1
                elif ch == ')': depth -= 1
            
            j = i + 1
            in_confirm = False
            in_dismiss = False
            confirm_depth = 0
            dismiss_depth = 0
            
            while j < len(result) and depth > 0:
                jline = result[j]
                jstripped = jline.strip()
                
                # Count parens
                for ch in jline:
                    if ch == '(': depth += 1
                    elif ch == ')':
                        depth -= 1
                        if depth == 0: break
                
                # Detect confirmButton/dismissButton sections
                if 'confirmButton' in jstripped and '=' in jstripped and '{' in jstripped:
                    in_confirm = True
                    in_dismiss = False
                    confirm_depth = 0
                    for ch in jline:
                        if ch == '{': confirm_depth += 1
                        elif ch == '}': confirm_depth -= 1
                elif 'dismissButton' in jstripped and '=' in jstripped and '{' in jstripped:
                    in_dismiss = True
                    in_confirm = False
                    dismiss_depth = 0
                    for ch in jline:
                        if ch == '{': dismiss_depth += 1
                        elif ch == '}': dismiss_depth -= 1
                else:
                    if in_confirm:
                        for ch in jline:
                            if ch == '{': confirm_depth += 1
                            elif ch == '}':
                                confirm_depth -= 1
                                if confirm_depth <= 0:
                                    in_confirm = False
                    if in_dismiss:
                        for ch in jline:
                            if ch == '{': dismiss_depth += 1
                            elif ch == '}':
                                dismiss_depth -= 1
                                if dismiss_depth <= 0:
                                    in_dismiss = False
                
                # Inside confirmButton: convert TextButton to Button with confirmButtonColors
                if in_confirm and 'TextButton(' in jstripped:
                    # Check if this is a danger button
                    is_danger = False
                    for la in range(j, min(j + 4, len(result))):
                        la_text = result[la]
                        if any(kw in la_text for kw in ['color = DangerRed', 'color = Color.Red', 'color = androidx.compose.ui.graphics.Color.Red']):
                            is_danger = True
                        if re.search(r'Text\("(Delete|Remove|Purge)', la_text):
                            is_danger = True
                        if re.search(r'Text\("[^"]*Delete', la_text):
                            is_danger = True
                    
                    if is_danger:
                        # Convert to Button with dangerButtonColors
                        new_line = jline.replace('TextButton(', 'Button(')
                        # Insert colors parameter
                        # Find the ) { pattern (end of Button params, start of content)
                        close_match = re.search(r'\)\s*\{', new_line)
                        if close_match:
                            insert_pos = close_match.start()
                            new_line = new_line[:insert_pos] + ', colors = CwocDialogDefaults.dangerButtonColors()' + new_line[insert_pos:]
                        result[j] = new_line
                    else:
                        # Convert to Button with confirmButtonColors
                        new_line = jline.replace('TextButton(', 'Button(')
                        close_match = re.search(r'\)\s*\{', new_line)
                        if close_match:
                            insert_pos = close_match.start()
                            new_line = new_line[:insert_pos] + ', colors = CwocDialogDefaults.confirmButtonColors()' + new_line[insert_pos:]
                        result[j] = new_line
                
                # Inside dismissButton: check for danger buttons
                if in_dismiss and 'TextButton(' in jstripped:
                    is_danger = False
                    for la in range(j, min(j + 4, len(result))):
                        la_text = result[la]
                        if any(kw in la_text for kw in ['color = DangerRed', 'color = Color.Red', 'color = androidx.compose.ui.graphics.Color.Red']):
                            is_danger = True
                        if re.search(r'Text\("(Delete|Remove|Purge)', la_text):
                            is_danger = True
                        if re.search(r'Text\("[^"]*Delete', la_text):
                            is_danger = True
                    
                    if is_danger:
                        new_line = jline.replace('TextButton(', 'Button(')
                        close_match = re.search(r'\)\s*\{', new_line)
                        if close_match:
                            insert_pos = close_match.start()
                            new_line = new_line[:insert_pos] + ', colors = CwocDialogDefaults.dangerButtonColors()' + new_line[insert_pos:]
                        result[j] = new_line
                
                if depth == 0:
                    break
                j += 1
            
            i = j + 1
        else:
            i += 1
    
    # Now remove color = DangerRed / color = Color.Red from Text inside buttons that now have dangerButtonColors
    # The button colors handle the text color, so explicit color on Text is redundant
    content = '\n'.join(result)
    
    # Remove color = DangerRed from Text() calls that are inside Button(... dangerButtonColors
    # This is hard to do contextually, so let's just remove the explicit red colors from Text in buttons
    # Pattern: Text("Delete...", color = DangerRed) → Text("Delete...")
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*DangerRed\)', r'\1)', content)
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*Color\.Red\)', r'\1)', content)
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*androidx\.compose\.ui\.graphics\.Color\.Red\)', r'\1)', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Main
files = find_kt_files()
print(f"Processing {len(files)} files for button color updates...")
modified = 0
for f in files:
    if process_file_v2(f):
        modified += 1
        print(f"  Modified: {f.replace(BASE, '')}")

print(f"\nDone. Modified {modified} files.")
