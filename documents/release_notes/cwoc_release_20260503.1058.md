# Release 20260503.1058 — Maps Marker Interactions

- **Popup icons**: Restored all calendar-supported indicator icons in map popups (alerts, recurring, checklist, people, health, habit, pinned, archived, shared, status). Each icon has cursor:pointer and a descriptive tooltip on hover.
- **Cmd/Ctrl+click**: Clicking a marker on the map while holding Cmd (macOS) or Ctrl opens the chit/contact editor in a new tab instead of showing the popup.
- **Title tooltips**: Single (non-stacked) markers now show a hover tooltip with just the title. Click to see the full popup with details.
- **Mixed clusters**: When both chits and people are stacked together, the cluster shows "chitCount/contactCount" (e.g., "3/2") in a combined shape.
- **Loading toast**: Text is now left-aligned with a fixed-width inner span so it doesn't jump during the dot animation.
- **People "All" checkbox**: Added an "All" checkbox next to the People filter label. When checked, shows all people regardless of date filters.
