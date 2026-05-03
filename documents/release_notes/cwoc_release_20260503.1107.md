# Release 20260503.1107 — Sidebar Border, Weather Filtering, Map Fixes

**Sidebar:**
- Restored the right border on both maps and weather page sidebars (was accidentally removed)

**Weather page:**
- Fixed content overlapping the sidebar — content now properly shifts right when sidebar is open
- Period filtering now actually works — selecting "This Week" hides all weather blocks outside that week, "Day" shows only one day, etc. Prev/next arrows navigate through periods.

**Maps page:**
- Loading indicator now uses a CSS spinner (matching the weather page style) instead of animated dots
- Tooltips are now permanent (always visible, not just on hover) and automatically hide when a popup opens
- Mixed clusters now properly show both counts — amber square with chit count + teal circle badge with contact count (was only showing one number)
- "All People" checkbox moved from the sidebar filter to the header bar next to the Chits/Both/People toggle. When checked, greys out the people filter section in the sidebar.
