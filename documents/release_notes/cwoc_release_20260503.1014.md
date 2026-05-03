# Release 20260503.1014 — Settings Subsection Collapsing, Maps Cleanup

**Settings page:**
- Fixed collapsible sections: each subsection (setting-subheader) is now independently collapsible with its own ▼/▶ indicator. The h3 box title still collapses the whole box. Subsection collapsed state persists separately to localStorage. Boxes shrink to fit when subsections are collapsed.

**Maps page:**
- Removed the entire bottom status bar (legends, loading indicator). Loading now shows as a floating toast overlay centered at the top of the map.
- Added "Today" period option to the dropdown.
- Removed "No Status" row from chit popups. Status icon now appears in the icons row only when the chit has a real status.
- Removed legend management functions (no longer needed without the status bar).
- Mode switching properly clears both marker groups before re-rendering.
