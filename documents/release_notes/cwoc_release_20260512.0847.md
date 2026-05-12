# Release 20260512.0847

Fixed recurring chit drag in month view — virtual instances are now found correctly by looking in the expanded displayed chits (window._cwocDisplayedChits) rather than the raw chits array which doesn't contain virtual instances. The recurring drag modal (_showRecurringDragModal) now fires properly.
