# Release 20260501.1942

Mobile touch drag fixes across six dashboard views:

- Fixed calendar quick-edit popup firing after touch drag by replacing the deprecated standalone `enableLongPress()` with unified gesture coordination through `enableTouchGesture()` in `enableCalendarDrag()`
- Fixed notes drag targeting in masonry layout by setting `pointer-events: none` on the dragged card before `elementFromPoint()` calls
- Added touch drag-to-reorder for Projects kanban headers via `enableTouchGesture()`
- Added touch drag-to-reorder for Projects list view project headers via `enableTouchGesture()`
- Added touch drag-to-reorder for independent alert cards (alarms, timers, stopwatches) with localStorage persistence
- Added touch drag-to-reorder for indicator chart sections with localStorage persistence
