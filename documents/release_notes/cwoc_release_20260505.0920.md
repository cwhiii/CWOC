# Release 20260505.0920

Overhauled the "Add Child Chit" modal in the Projects zone:
- ESC now properly closes the modal instead of trying to exit the editor
- Multi-select with checkboxes — select multiple chits and add them all at once
- Chits already in the project are shown with a muted style and ✓ icon (unselectable)
- Search filters by title, status, and tags
- Click a row to toggle its checkbox, double-click to add immediately
- Click overlay or Cancel button to dismiss
- Fixed dashboard text filter matching system tags (searching "check" no longer returns all checklist chits)
