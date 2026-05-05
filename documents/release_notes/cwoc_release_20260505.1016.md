# Release 20260505.1016

Project zone overhaul:
- All status dropdowns are now fixed-width (110px) for visual consistency
- Added ✕ "Remove from project" button on each child chit card (unlinks without deleting, with confirmation)
- Delete child chit confirmation now shows "child" in red, bold, underlined — matches the main editor delete style
- `cwocConfirm` now supports `html: true` option for rich confirmation messages
- Fixed `renderKanbanBoard` reference error (was calling non-existent function)
- Fixed overflow: project zone content now clips horizontally and scrolls vertically
- Move-to-project button only shows when multiple projects exist
