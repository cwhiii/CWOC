# Release 20260503.1002 — Settings Restructure, Maps Improvements, Weather Sidebar

**Settings page restructuring:**
- Time Periods block split into "Calendar Settings" and "Enabled Periods" subsections
- Clocks is its own subsection with Time Format moved into it
- Remaining general items (Sex, Units, Snooze, Calendar Snap) under "⚙️ General" subsection
- "Hide declined chits" moved to Display Options > Chit Options

**Maps improvements:**
- Chit popup now shows indicator icons (alerts, recurring, checklist, people, pinned, archived, habit, shared) in a row at the top, with tooltips — only icons that apply are shown
- Removed border between sidebar and header bar
- Order dropdown hidden (not applicable for maps)
- Selected date range now displayed between the period navigation arrows
- Mode switching clears both marker groups before re-rendering to prevent stale markers

**Weather page shared sidebar:**
- Weather page now uses the shared sidebar for consistent navigation across all pages
- Navigation-only mode: Create Chit, Contacts, Maps, Clock, Kiosk, Calculator, Notifications, Settings, Help
- Weather button highlighted/disabled to indicate current page
- Sections not relevant to weather are hidden: Order, Period, Date Nav, Filters, tab-specific sections
- Author footer hidden (sidebar has its own branding)
