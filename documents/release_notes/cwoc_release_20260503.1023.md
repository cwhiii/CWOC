# Release 20260503.1023 — Weather Sidebar Filters, Maps Navigation Fixes

**Weather page sidebar:**
- Restored period dropdown, date navigation, and filters — the sidebar now shows all the same filter controls as the maps page so you can filter which dates appear
- Period options: All (16 days), Day, This Week, This Month
- Prev/next arrows navigate through periods with offset tracking
- Today button resets to "All (16 days)"
- Only Order and tab-specific sections are hidden

**Maps page:**
- Loading toast expanded with larger padding, min-width, and centered text so it doesn't resize with each dot
- Cmd/Ctrl+click on "Open in Editor" or "Open Contact" links now opens in a new tab
- Popup icons trimmed to only alerts 🔔, people 👥, pinned 📌, and status — removed recurring, checklist, archived, habit, and shares icons
- Prev/next arrows now properly navigate through time periods (day/week/month/quarter/year) with offset tracking
- Period dropdown change resets the offset to 0
- "Today" renamed to "Day" in the period dropdown
- Today button resets offset and period to "This Week"
