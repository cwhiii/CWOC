# Release 20260501.1803

Checklist editor rewrite: Fixed centering (removed conflicting align-items, removed dashed borders). Input/textarea now fills full width from checkbox to trashcan using proper flex layout. Editing uses textarea instead of input so Shift+Enter inserts a newline within the current item (Enter still creates a new item). Clear Checked button moved inside the completed section header where it actually works (was broken in zone header due to cwocConfirm being Promise-based). Inline undo countdown bar for both single-item delete and clear-checked.
