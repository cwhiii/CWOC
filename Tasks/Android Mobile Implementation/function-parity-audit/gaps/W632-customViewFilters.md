# W632-633: Custom View Filters (Per-Tab Defaults)

## What the web functions do
- `_applyCustomViewFilters(tab)` (W632) — When switching to a tab (Tasks, Notes, Calendar, etc.), reads the `custom_view_filters` setting for that tab and auto-applies those filters. For example, Tasks tab might default to showing only "ToDo" and "In Progress" statuses.
- `_resetDefaultFilters()` (W633) — Resets filters to the tab's custom defaults (not empty — the configured defaults for that view).

## What exists on Android
- `custom_view_filters` setting is synced and stored in SettingsEntity
- FilterSortViewModel has filter state
- `clearFilters()` resets to empty (no filters) rather than to custom defaults
- Tab switching does not auto-apply per-tab default filters

## What's missing
1. No auto-application of per-tab custom view filters on tab switch
2. `clearFilters()` resets to empty rather than to the tab's configured defaults
3. The `custom_view_filters` JSON is stored but never parsed/applied at runtime
4. Users' configured default filters for each view are ignored on Android
