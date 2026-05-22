#!/usr/bin/env python3
"""
Apply CwocDialogDefaults theming to all AlertDialog usages in the CWOC Android app.

Phase 1: containerColor, modifier, titleStyle
Phase 2: Button colors for confirm and danger buttons
"""
import os
import re

BASE = "/Users/cwhiii/Personal/Misc/Development/CWOC/android/app/src/main/java/com/cwoc/app"
IMPORT_LINE = "import com.cwoc.app.ui.theme.CwocDialogDefaults"
BUTTON_IMPORT = "import androidx.compose.material3.Button"

def find_kt_files_with_alert_dialog():
    results = []
    for root, dirs, files in os.walk(BASE):
        for f in files:
            if f.endswith('.kt'):
                path = os.path.join(root, f)
                with open(path, 'r') as fh:
                    content = fh.read()
                if 'AlertDialog(' in content:
                    results.append(path)
    return sorted(results)

def add_import_if_missing(content, import_line):
    if import_line in content:
        return content
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import_idx = i
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, import_line)
    return '\n'.join(lines)

def find_alert_dialog_block_end(lines, start_idx):
    """Find the closing paren of an AlertDialog( call."""
    paren_depth = 0
    line = lines[start_idx]
    ad_pos = line.find('AlertDialog(')
    if ad_pos < 0:
        ad_pos = line.find('.AlertDialog(')
        if ad_pos >= 0:
            ad_pos = line.index('AlertDialog(', ad_pos)
    
    started = False
    for ci in range(ad_pos, len(line)):
        if line[ci] == '(':
            paren_depth += 1
            started = True
        elif line[ci] == ')':
            paren_depth -= 1
            if started and paren_depth == 0:
                return start_idx
    
    for i in range(start_idx + 1, len(lines)):
        for ch in lines[i]:
            if ch == '(':
                paren_depth += 1
            elif ch == ')':
                paren_depth -= 1
                if paren_depth == 0:
                    return i
    return len(lines) - 1

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Add imports
    content = add_import_if_missing(content, IMPORT_LINE)
    content = add_import_if_missing(content, BUTTON_IMPORT)
    
    # Phase 1: containerColor and modifier
    lines = content.split('\n')
    
    ad_starts = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.search(r'\bAlertDialog\s*\(', stripped) and not stripped.startswith('//') and not stripped.startswith('*') and not stripped.startswith('/*'):
            ad_starts.append(i)
    
    for ad_start in reversed(ad_starts):
        ad_end = find_alert_dialog_block_end(lines, ad_start)
        block = lines[ad_start:ad_end + 1]
        block_text = '\n'.join(block)
        
        has_container_color = 'containerColor' in block_text
        has_modifier_border = 'CwocDialogDefaults.borderModifier' in block_text
        
        if 'containerColor = MaterialTheme.colorScheme.surface' in block_text:
            for bi in range(len(block)):
                if 'containerColor = MaterialTheme.colorScheme.surface' in block[bi]:
                    block[bi] = block[bi].replace(
                        'containerColor = MaterialTheme.colorScheme.surface',
                        'containerColor = CwocDialogDefaults.containerColor'
                    )
            has_container_color = True
        
        ondismiss_bi = -1
        for bi in range(len(block)):
            if 'onDismissRequest' in block[bi]:
                ondismiss_bi = bi
                break
        
        if ondismiss_bi >= 0:
            indent = len(block[ondismiss_bi]) - len(block[ondismiss_bi].lstrip())
            indent_str = ' ' * indent
            insertions = []
            if not has_modifier_border:
                insertions.append(f"{indent_str}modifier = CwocDialogDefaults.borderModifier,")
            if not has_container_color:
                insertions.append(f"{indent_str}containerColor = CwocDialogDefaults.containerColor,")
            
            if insertions:
                for ins_idx, ins_line in enumerate(insertions):
                    block.insert(ondismiss_bi + 1 + ins_idx, ins_line)
        
        lines[ad_start:ad_end + 1] = block
    
    content = '\n'.join(lines)
    
    # Phase 1b: Title styling (single-line titles)
    lines = content.split('\n')
    result_lines = []
    for i, line in enumerate(lines):
        if 'CwocDialogDefaults.titleStyle' in line:
            result_lines.append(line)
            continue
        m = re.search(r'(title\s*=\s*\{\s*)Text\(', line)
        if m:
            text_start = line.index('Text(', m.start())
            paren_count = 0
            text_end = -1
            for ci in range(text_start + 4, len(line)):
                if line[ci] == '(':
                    paren_count += 1
                elif line[ci] == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        text_end = ci
                        break
            if text_end > 0:
                text_inner = line[text_start + 5:text_end]
                text_inner = re.sub(r',?\s*fontWeight\s*=\s*FontWeight\.Bold', '', text_inner)
                text_inner = re.sub(r'fontWeight\s*=\s*FontWeight\.Bold\s*,?\s*', '', text_inner)
                text_inner = re.sub(r',?\s*color\s*=\s*Color\(0xFF[0-9A-Fa-f]+\)', '', text_inner)
                text_inner = re.sub(r'color\s*=\s*Color\(0xFF[0-9A-Fa-f]+\)\s*,?\s*', '', text_inner)
                text_inner = re.sub(r',?\s*color\s*=\s*ParchmentText', '', text_inner)
                text_inner = re.sub(r'color\s*=\s*ParchmentText\s*,?\s*', '', text_inner)
                text_inner = text_inner.strip().rstrip(',').strip()
                if text_inner:
                    new_text = f"Text({text_inner}, style = CwocDialogDefaults.titleStyle)"
                else:
                    new_text = f"Text(style = CwocDialogDefaults.titleStyle)"
                new_line = line[:text_start] + new_text + line[text_end + 1:]
                result_lines.append(new_line)
            else:
                result_lines.append(line)
        else:
            result_lines.append(line)
    content = '\n'.join(result_lines)
    
    # Phase 2: Button colors
    # Strategy: Find single-line TextButton patterns and add colors parameter
    # For single-line: TextButton(onClick = { ... }) { → TextButton(onClick = { ... }, colors = ...) {
    # For danger: look for Text("Delete/Remove") or color = Red nearby
    
    lines = content.split('\n')
    result_lines = []
    
    # Track if we're inside an AlertDialog block
    in_alert_dialog_depth = 0
    in_confirm_block = False
    confirm_brace_depth = 0
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Track AlertDialog blocks (rough)
        if re.search(r'\bAlertDialog\s*\(', stripped) and not stripped.startswith('//'):
            in_alert_dialog_depth += 1
        
        # Track confirmButton blocks
        if in_alert_dialog_depth > 0:
            if 'confirmButton = {' in stripped or 'confirmButton =' in stripped:
                in_confirm_block = True
                confirm_brace_depth = 0
            
            if in_confirm_block:
                for ch in line:
                    if ch == '{': confirm_brace_depth += 1
                    elif ch == '}': confirm_brace_depth -= 1
                if confirm_brace_depth <= 0 and i > 0:
                    in_confirm_block = False
        
        # Handle single-line TextButton patterns inside AlertDialog
        if in_alert_dialog_depth > 0 and 'TextButton(' in stripped and 'colors =' not in line:
            # Check if this is a single-line pattern: TextButton(onClick = ...) {
            match = re.search(r'(TextButton\(onClick\s*=\s*[^)]*)\)\s*\{', line)
            if match:
                # Determine if danger or confirm
                is_danger = False
                # Look ahead for danger indicators
                for la in range(i, min(i + 4, len(lines))):
                    la_text = lines[la] if la < len(lines) else ''
                    if 'color = DangerRed' in la_text or 'color = Color.Red' in la_text or 'color = androidx.compose.ui.graphics.Color.Red' in la_text:
                        is_danger = True
                    if re.search(r'Text\("[^"]*[Dd]elete', la_text):
                        is_danger = True
                    if re.search(r'Text\("[^"]*[Rr]emove', la_text):
                        is_danger = True
                    if re.search(r'Text\("[^"]*[Pp]urge', la_text):
                        is_danger = True
                
                # Check if this is a cancel/dismiss button (don't add colors to those)
                is_cancel = False
                for la in range(i, min(i + 3, len(lines))):
                    la_text = lines[la] if la < len(lines) else ''
                    if re.search(r'Text\("Cancel"', la_text) or re.search(r'Text\("Close"', la_text) or re.search(r'Text\("Dismiss"', la_text) or re.search(r'Text\("No"', la_text):
                        is_cancel = True
                
                if is_cancel and not is_danger:
                    result_lines.append(line)
                elif is_danger:
                    # Add dangerButtonColors
                    new_line = line.replace(') {', ', colors = CwocDialogDefaults.dangerButtonColors()) {', 1)
                    result_lines.append(new_line)
                elif in_confirm_block:
                    # Add confirmButtonColors
                    new_line = line.replace(') {', ', colors = CwocDialogDefaults.confirmButtonColors()) {', 1)
                    result_lines.append(new_line)
                else:
                    result_lines.append(line)
            else:
                result_lines.append(line)
        else:
            result_lines.append(line)
        
        # Track AlertDialog closing (rough heuristic)
        if in_alert_dialog_depth > 0:
            # Count closing parens at start of line
            if stripped == ')' or stripped == '),':
                # Could be AlertDialog closing - decrement
                pass  # This is too rough, skip
    
    content = '\n'.join(result_lines)
    
    # Remove explicit red color from Text inside danger buttons
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*DangerRed\)', r'\1)', content)
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*Color\.Red\)', r'\1)', content)
    content = re.sub(r'(Text\("[^"]*")\s*,\s*color\s*=\s*androidx\.compose\.ui\.graphics\.Color\.Red\)', r'\1)', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Main
files = find_kt_files_with_alert_dialog()
print(f"Processing {len(files)} files...")
modified = 0
for f in files:
    if process_file(f):
        modified += 1
        print(f"  Modified: {f.replace(BASE, '')}")
    else:
        print(f"  Unchanged: {f.replace(BASE, '')}")

print(f"\nDone. Modified {modified}/{len(files)} files.")
