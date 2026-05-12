# Release 20260512.0821

Fixed drag & drop in compress mode — removed overflow:hidden from .month-day (kept only on .day-events container). The browser needs the dragged element to not be clipped by its parent to generate the drag ghost.
