# Release 20260501.1729

Mobile drag fixes: Added drag-to-reorder support for child chits in the non-Kanban projects list view (both HTML5 drag and touch gesture with long-press for quick-edit). Enhanced visual drag feedback across all views — dragged items now show a dashed outline with pulse animation, stronger shadow, and ring highlight so it's immediately obvious when drag is active. Replaced inline opacity hacks with CSS classes (`cwoc-dragging`, `cwoc-touch-dragging`) for consistent feedback on both desktop and mobile.
