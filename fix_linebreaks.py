#!/usr/bin/env python3
"""
Fix corrupted Kotlin files with spurious line breaks in the middle of words.
The corruption pattern: words are split across lines with extra whitespace.
"""

import re
import sys

files_to_fix = [
    'android/app/src/main/java/com/cwoc/app/MainActivity.kt',
    'android/app/src/main/java/com/cwoc/app/data/mapper/ChitMapper.kt',
    'android/app/src/main/java/com/cwoc/app/data/sync/DtoMappers.kt',
    'android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarViewModel.kt',
    'android/app/src/main/java/com/cwoc/app/ui/screens/email/EmailViewModel.kt',
    'android/app/src/main/java/com/cwoc/app/ui/screens/projects/ProjectsViewModel.kt',
    'android/app/src/main/java/com/cwoc/app/ui/screens/settings/AdminSettingsTab.kt',
    'android/app/src/main/java/com/cwoc/app/ui/screens/tasks/TimelineAlgorithms.kt',
]

for filepath in files_to_fix:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        fixed_lines = []
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Check if this line ends mid-word (letter/digit followed by newline)
            # and next line starts with spaces then a lowercase letter (continuation)
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                # Pattern: current line ends with alphanumeric, next starts with whitespace + lowercase
                if (line.rstrip() and 
                    line.rstrip()[-1].isalnum() and 
                    next_line.lstrip() and 
                    next_line[0].isspace() and
                    next_line.lstrip()[0].islower()):
                    # Merge: remove newline from current, strip leading space from next
                    fixed_lines.append(line.rstrip() + next_line.lstrip())
                    i += 2
                    continue
            
            fixed_lines.append(line)
            i += 1
        
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)
        
        print(f"Fixed {filepath}: {len(lines)} -> {len(fixed_lines)} lines")
    
    except Exception as e:
        print(f"Error with {filepath}: {e}", file=sys.stderr)
        sys.exit(1)

print("All files fixed successfully")
