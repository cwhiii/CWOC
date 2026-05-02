# Release 20260501.1816

Three fixes for mobile drag-and-drop:

1. Fixed capture-phase click suppression to use correct CSS classes for calendar events (timed-event, day-event, itinerary-event) instead of the non-existent cal-event class. This was why quick-edit still opened after dragging calendar events.

2. Fixed enableLongPress to re-check drag state when its timer fires, not just at touchstart. Prevents long-press from firing if a drag started during the hold period.

3. Restored drag hold to 400ms (matching Android default) and increased long-press to 1200ms, giving an 800ms gap. The sequential timer model ensures long-press timer only starts after drag activates, and any movement permanently cancels it.
