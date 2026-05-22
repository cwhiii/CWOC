# W129-W134: Omni View Filter Locking

## What the web feature does
Allows users to "lock" filter defaults for the Omni View so it always opens with specific filters applied:
- W129: `_applyOmniEntryFilters()` — applies locked filters when entering Omni view
- W130: `_applyLockedFiltersToSidebar(locked)` — sets sidebar filter UI to locked state
- W131: `_showOmniLockedIndicator(show)` — shows a visual indicator that filters are locked
- W132: `_lockOmniFilters()` — saves current filters as the locked defaults
- W133/W134: show/hide the lock button

## What exists on Android
Nothing. The Omni View exists but has no filter locking mechanism.

## What's missing
The entire filter locking feature for Omni View.

## Fix needed
Add a "Lock Filters" action to the Omni View that persists the current filter state as defaults (stored in settings as `omni_locked_filters`). On Omni View entry, apply those locked filters automatically.
