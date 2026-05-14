## 20260513.2209 — URL Hash Routing for Bookmarkable Views

Added hash-based URL routing to the dashboard. The URL now always reflects the current tab and mode (e.g., `#calendar/day`, `#tasks/habits`, `#alarms/independent`). This enables bookmarking specific views and pinning them as standalone apps on mobile home screens. Browser back/forward navigation between hash states is also supported. Existing `?tab=` deep links (ntfy notifications) are preserved and automatically converted to hash URLs.
