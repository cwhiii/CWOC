# Release 20260505.0739

Added checklist auto-save. Checklist changes (add, delete, check, reorder) are now automatically saved to the server after a 1.5s debounce, without requiring a full chit save. Other fields still require the normal Save button. Includes a per-user global setting (default: on) in Settings → Chit Options, and a per-chit toggle button in the checklist zone header to override the global. A brief "✓ saved" indicator flashes in the zone header on successful auto-save.
