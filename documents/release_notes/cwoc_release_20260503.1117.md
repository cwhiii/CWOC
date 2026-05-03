# Release 20260503.1117 — Header Border, Weather Filters, Mixed Clusters

- **Header border**: On maps and weather pages, the header bar's bottom border now stops where it meets the sidebar edge (header shifts right by 240px when sidebar is active)
- **Weather filters**: ALL sidebar filters now work on the weather page — status, priority, tags, people, and text search. When a filter is active, only days that have matching chits are shown. Combined with the period filter for AND logic.
- **Maps loading**: Cleaned up unused dot-animation variable. Loading toast uses CSS spinner only.
- **Mixed clusters**: Simplified to reliable "X/Y" text format (e.g., "3/2" for 3 chits and 2 contacts) instead of positioned divs that conflicted with CSS classes.
