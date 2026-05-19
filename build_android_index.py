#!/usr/bin/env python3
"""Build Android function index from raw grep output."""
import re
from collections import defaultdict

# Read raw function data
functions = []
seen = set()

with open('/tmp/android_functions_raw.txt', 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split('|', 2)
        if len(parts) < 3:
            continue
        filepath, lineno, content = parts[0], parts[1], parts[2].strip()
        # Extract function name
        match = re.search(r'\bfun\s+(\w+)', content)
        if not match:
            continue
        func_name = match.group(1)
        key = f"{filepath}:{func_name}"
        if key in seen:
            continue
        seen.add(key)
        # Clean up content for description
        desc = content.strip()
        # Remove opening brace and everything after
        desc = re.sub(r'\s*\{.*', '', desc)
        desc = re.sub(r'\s*=\s*$', '', desc)
        # Trim very long lines
        if len(desc) > 120:
            desc = desc[:117] + '...'
        functions.append((filepath, func_name, desc))

# Read composable data
with open('/tmp/android_composables_raw.txt', 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split('|', 2)
        if len(parts) < 3:
            continue
        filepath, lineno, content = parts[0], parts[1], parts[2].strip()
        match = re.search(r'\bfun\s+(\w+)', content)
        if not match:
            continue
        func_name = match.group(1)
        key = f"{filepath}:{func_name}"
        if key in seen:
            continue
        seen.add(key)
        desc = content.strip()
        desc = re.sub(r'\s*\{.*', '', desc)
        desc = re.sub(r'\s*=\s*$', '', desc)
        if len(desc) > 120:
            desc = desc[:117] + '...'
        desc = "@Composable " + desc
        functions.append((filepath, func_name, desc))

# Group by directory
groups = defaultdict(list)
for filepath, func_name, desc in functions:
    # Get the directory part
    parts = filepath.split('/')
    if len(parts) > 1:
        group = '/'.join(parts[:-1])
    else:
        group = '(root)'
    groups[group].append((filepath, func_name, desc))

# Sort groups
sorted_groups = sorted(groups.items())

# Write output
output_path = '/Users/cwhiii/Personal/Misc/Development/CWOC/Tasks/Android Mobile Implementation/Android App Function Index.md'
with open(output_path, 'w') as out:
    out.write("# CWOC Android App — Complete Function Index\n\n")
    out.write("> Every function in the Android app source code.\n")
    out.write(f"> Total: {len(functions)} functions across {len(set(f[0] for f in functions))} files.\n\n")
    out.write("---\n\n")
    
    for group, funcs in sorted_groups:
        out.write(f"## {group}/\n\n")
        out.write("| File | Function | Signature |\n")
        out.write("|------|----------|----------|\n")
        # Sort by file then function name
        for filepath, func_name, desc in sorted(funcs, key=lambda x: (x[0], x[1])):
            filename = filepath.split('/')[-1]
            # Escape pipes in desc
            desc_escaped = desc.replace('|', '\\|')
            out.write(f"| {filename} | `{func_name}` | {desc_escaped} |\n")
        out.write("\n")

print(f"Done. {len(functions)} functions written to {output_path}")
