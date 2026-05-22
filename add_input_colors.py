#!/usr/bin/env python3
"""
Script to add colors = CwocInputDefaults.outlinedColors() to all OutlinedTextField calls
in a given Kotlin file that don't already have a colors parameter.
Also adds the import if not present.
"""
import re
import sys

def add_import(lines, import_line):
    """Add import if not already present."""
    import_text = import_line.strip()
    for line in lines:
        if import_text in line:
            return lines
    # Find last import line and add after it
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
    lines.insert(last_import_idx + 1, import_line + '\n')
    return lines

def add_colors_to_outlined_textfields(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # Add import
    lines = add_import(lines, 'import com.cwoc.app.ui.theme.CwocInputDefaults')
    
    result = []
    i = 0
    changes = 0
    
    while i < len(lines):
        line = lines[i]
        # Check if this line contains OutlinedTextField(
        if 'OutlinedTextField(' in line:
            # Find the closing ) of this OutlinedTextField call
            start_i = i
            paren_depth = 0
            found_colors = False
            
            # Count parens from the OutlinedTextField( position
            idx = line.index('OutlinedTextField(')
            for ch in line[idx:]:
                if ch == '(':
                    paren_depth += 1
                elif ch == ')':
                    paren_depth -= 1
            
            if paren_depth == 0:
                # Single-line call
                result.append(line)
                i += 1
                continue
            
            # Scan subsequent lines to find the closing paren
            j = i + 1
            while j < len(lines) and paren_depth > 0:
                for ch in lines[j]:
                    if ch == '(':
                        paren_depth += 1
                    elif ch == ')':
                        paren_depth -= 1
                        if paren_depth == 0:
                            break
                j += 1
            
            end_i = j  # end_i is exclusive (line after the closing paren)
            
            # Check if colors = CwocInputDefaults is already in the block
            block = ''.join(lines[start_i:end_i])
            if 'colors = CwocInputDefaults' in block or 'colors = cwocTextFieldColors' in block:
                found_colors = True
            
            if found_colors:
                # Already has colors, just copy as-is
                for k in range(start_i, end_i):
                    result.append(lines[k])
            else:
                # Need to add colors parameter before the closing )
                # The closing ) is on lines[end_i - 1]
                closing_line = lines[end_i - 1]
                closing_indent = len(closing_line) - len(closing_line.lstrip())
                param_indent = closing_indent + 4
                
                # Copy all lines up to (but not including) the closing paren line
                for k in range(start_i, end_i - 1):
                    if k == end_i - 2:
                        # Last parameter line - ensure it has a trailing comma
                        stripped = lines[k].rstrip('\n').rstrip()
                        if stripped and not stripped.endswith(',') and not stripped.endswith('{') and not stripped.endswith('}'):
                            result.append(stripped + ',\n')
                        elif stripped and stripped.endswith('}') and not stripped.endswith('},'):
                            result.append(stripped + ',\n')
                        else:
                            result.append(lines[k])
                    else:
                        result.append(lines[k])
                
                # Add the colors parameter
                colors_line = ' ' * param_indent + 'colors = CwocInputDefaults.outlinedColors()\n'
                result.append(colors_line)
                # Add the closing paren line
                result.append(closing_line)
                changes += 1
            
            i = end_i
        else:
            result.append(line)
            i += 1
    
    with open(filepath, 'w') as f:
        f.writelines(result)
    
    print(f"Modified {changes} OutlinedTextField calls in {filepath}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python add_input_colors.py <file.kt>")
        sys.exit(1)
    add_colors_to_outlined_textfields(sys.argv[1])
