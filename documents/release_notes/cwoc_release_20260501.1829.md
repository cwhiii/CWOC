# Release 20260501.1829

Checklist editing polish: Fixed font/size mismatch between view and edit mode — textarea now uses `font-size: inherit !important; font-family: inherit !important; padding: 0 !important; background: transparent !important` to override the `.editor textarea` rules from shared-editor.css. Clicking empty space on the line (text-wrapper or left-container) now starts editing or focuses the existing textarea with cursor at end.
