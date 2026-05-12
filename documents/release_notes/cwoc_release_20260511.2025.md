## Release 20260511.2025

Fixed undo for split — the undo snapshot now captures the full textarea content (the combined text the user sees) before splitting, so undoing restores the original unsplit item with its complete text.
