# 20260503 Highlights

- Added email integration — Email tab, email zone in editor, send/receive
- Added iCalendar (.ics) file import

---

## 20260503.2132

- Replaced right-click context menu on email cards with shift+click to toggle read/unread; added bulk "Mark Read/Unread" button to the email selection bar
- Added debug logging to the email thread endpoint for troubleshooting threading issues (logs anchor message_id, in_reply_to, references, and match count)
- Moved the Attachments zone to the very bottom of column-two in the chit editor (after Health Indicators and Email)
- Fixed save button state not resetting when deactivating email mode on a chit — now unpatches CwocSaveSystem and restores normal save buttons
- Added 📎 attachment indicator with count tooltip to chit header cards across all views
- Added console.log debug statements to email HTML rendering pipeline (initEmailZone, _setupHtmlEmailView) for diagnosing raw HTML display issues
- Updated README.md and technical_details.md to reflect shift+click read/unread change

## 20260503.2118

— Email Integration Enhancements

Five email-related features added in this release:

1. **Read/Unread Toggle** — Right-click (or long-press on mobile) email cards in the Email tab to toggle read/unread status via context menu. The PATCH endpoint now toggles instead of only marking as read.

2. **Email Threading** — New `GET /api/email/thread/{chit_id}` endpoint finds related emails by Message-ID references and subject line matching. Thread view renders below the email body in the editor, showing sender, date, and preview for each message in the conversation.

3. **Attachments Zone** — New zone in the chit editor for file attachments with drag-drop upload, download, and delete. Backend stores files at `/app/data/attachments/{chit_id}/` with metadata in a JSON column. Configurable max file size (5/10/25/50 MB) in Settings.

4. **HTML Email Rendering** — Incoming emails now preserve their HTML body. The editor shows a sandboxed iframe with DOMPurify sanitization and an HTML/Text toggle button for switching between rendered and plain-text views.

5. **FTS5 Full-Text Search** — SQLite FTS5 virtual table indexes title, note, email_body_text, and email_subject with automatic sync triggers. Search results are now ranked by relevance. Falls back to LIKE queries if FTS5 is unavailable.

## 20260503.2050

Map view: "All People" checkbox now only appears when in People or Both mode, hidden in Chits-only mode.

## 20260503.1736

Added basic email integration — emails are now chits with a dedicated Email zone in the editor and an Email tab on the dashboard. Connects to an external IMAP/SMTP server (Gmail defaults) via Python stdlib. Features include manual sync (Check Mail), compose/send/reply/forward, read/unread tracking with unread badge, inbox/drafts/trash sub-filters, email account configuration in Settings with test connection and backfill estimation, password encryption (Fernet with base64 fallback), reserved `CWOC_System/` tag namespace enforcement, and email-aware soft delete/restore.

## 20260503.1436

Added iCalendar (.ics) file import. Users can now import events and tasks from Google Calendar, Apple Calendar, or Outlook via a new "Import Calendar (.ics)" button in the Settings page Data Management section. The import handles VEVENT and VTODO components with field mapping, recurrence rule translation (DAILY/WEEKLY/MONTHLY/YEARLY), and duplicate detection. All imported chits are tagged with `cwoc_system/imported`. Includes 54 unit tests and help page documentation.

## 20260503.1331

Fixed map cluster icon rendering so contact-only clusters show as teal circles and mixed chit+contact clusters show as purple hexagons. Previously, contact-only clusters fell through to the chit-only branch and rendered as amber/brown squares.

## 20260503.1257

Fixed erratic map marker visibility in "Both" mode. Chit and contact markers no longer wipe each other out when rendering, filtering, or switching modes. Added type-aware marker removal so each set (chits vs contacts) is managed independently within the shared cluster group. Fixed race condition where concurrent fetches in "Both" mode caused unpredictable marker loss. Fixed "All People" checkbox to actually bypass filters. Removed unused `_mapsPeopleClusterGroup` variable and fixed Default View control that referenced it.

## 20260503.1252

Moved geocode caching from maps-only localStorage into shared-geocoding.js so all pages (weather, editor, maps, etc.) share a single geocode cache. Weather page now benefits from cached lat/lon lookups instead of hitting the backend geocode proxy on every load. Old maps-only cache is auto-migrated on first load.

## 20260503.1244

— Maps Geocode Cache

Geocoded coordinates (address → lat/lon) are now persisted to localStorage under `cwoc_maps_geocode_cache`. On the first visit, each address is geocoded via the Nominatim API and cached. On subsequent visits, cached coordinates are used instantly — markers appear immediately without waiting for API calls. Only new or changed addresses need fresh geocoding.

Both chit locations and contact addresses share the same unified cache. The cache is loaded at script parse time and saved after each new geocode result.

## 20260503.1238

— People Dates Field, Sidebar Rename

**Sidebar rename**: "Contacts" button renamed to "People" in the shared sidebar. Changes on all pages (dashboard, maps, weather) automatically since it's in shared-sidebar.js.

**Multi-value dates field for contacts/people**:
- New `dates` column on contacts table (JSON array, same pattern as phones/emails/addresses)
- Each entry has a label (e.g., "Birthday", "Anniversary", "Hire Date") and a date value
- New contacts default to one entry with label "Birthday" and empty date
- Uses HTML5 `type="date"` input for proper date picker
- vCard import/export supports BDAY field (maps to/from "Birthday" label)
- Searchable across dashboard people filter, maps contact search, and people page
- Contact editor has a "📅 Dates" section with "Add Date" button

## 20260503.1235

Added multi-value dates field to contacts (Birthday, Anniversary, etc.) with full-stack support: SQLite migration, Pydantic model, API serialization, vCard BDAY import/export, HTML5 date picker in the contact editor, and search across dates in people list, maps, and editor-people views.

## 20260503.1232

## Release 20260503.1232

Added 30 new demo chits (demo-0031 through demo-0060) in `new-chits.json`. All have locations and dates spread across May 3 – May 31, 2026. Wild assortment of priorities, statuses, checklists, notes, health data, notifications, and people references to all 6 existing contacts.

## 20260503.1228

— Weather Scrolling, Map Controls, Mobile

- **Weather scrolling**: Fixed — `.settings-panel` changed from `overflow: hidden` to `overflow: visible` so the `.weather-page-layout` child (with `overflow: auto; flex: 1; min-height: 0`) can properly scroll its content.
- **Map zoom controls**: Moved from top-left (Leaflet default) to bottom-right for better accessibility and to avoid overlapping the sidebar toggle.
- **Map mobile**: Added margin rules for fullscreen and default-view controls. Permanent tooltips hidden on mobile to reduce clutter.

## 20260503.1224

— Weather Page Full Layout Parity with Maps

Added the missing CSS rules in shared-page.css for the Weather page that the Maps page already had. The weather page was using the default secondary page styling (padded, max-width constrained, decorative border) instead of the full-viewport layout. Now both pages have identical rules:

- Body: full viewport (padding:0, margin:0, overflow:hidden, height:100vh, flex column)
- .settings-panel: full-width, no decoration (no border, no border-radius, no box-shadow, no background, no max-width)
- .settings-panel::before: hidden (removes the decorative top element)
- .author-info: hidden (sidebar has its own footer)
- .header-and-buttons: 100px height, full-width, gradient background, 2px bottom border, relative positioning
- .weather-page-layout: flex:1, overflow:auto (scrollable content area below the header)

This fixes the logo being cut off, the sidebar covering content, and the Help button overflowing.

## 20260503.1210

— Weather Page Layout Alignment

Weather page now uses the same layout structure as the maps page: `.settings-panel > .weather-page-layout > #weather-content`. The sidebar/header/content relationship follows the identical pattern — header stays full-width, content area shifts right when sidebar is active, border pseudo-element clips at the sidebar edge. Previously the weather page had a flat structure that caused the sidebar to cover content.

## 20260503.1144

— Proximity Clustering, Hexagon Fix, Weather Layout

- **Maps clustering**: Chits and contacts now cluster together by proximity instead of separately by type. Both marker types use the same MarkerClusterGroup, so nearby chits and contacts merge into mixed clusters naturally. Removed the separate people cluster group.
- **Mixed cluster hexagon**: Fixed — the hexagon shape is now applied via CSS `clip-path` on the cluster icon class itself (purple gradient, `!important` to override Leaflet defaults). Previously the clip-path was on the inner div which didn't render correctly.
- **Maps loading spinner**: Moved to the RIGHT of "Loading…" text (was incorrectly above it).
- **Weather page layout**: Fixed sidebar covering content — only `#weather-content` shifts right when sidebar is active, not the entire `.settings-panel`. Header stays full-width.
- **Header border**: Changed from margin-left approach to pseudo-element approach — header stays full-width, only the bottom border line starts at 240px from left when sidebar is active.

## 20260503.1122

— Hexagon Clusters, Header Border Fix

- **Mixed clusters**: Changed from square/circle to a hexagon shape with purple gradient, clearly distinguishing mixed chit+contact clusters from chit-only (square) and contact-only (circle) clusters. Shows "X/Y" count format.
- **Header border**: Fixed — header no longer shifts position when sidebar opens. Instead, the bottom border is clipped using a pseudo-element that starts at the sidebar's right edge (240px from left), so the header stays full-width but the border stops where the sidebar begins. Matches dashboard behavior.
- **Weather week lines**: Already using the week start day setting from user preferences. The `weekStartDay` is loaded from `settings.week_start_day` and passed to the table renderer which marks week-start dates for separator lines.

## 20260503.1117

— Header Border, Weather Filters, Mixed Clusters

- **Header border**: On maps and weather pages, the header bar's bottom border now stops where it meets the sidebar edge (header shifts right by 240px when sidebar is active)
- **Weather filters**: ALL sidebar filters now work on the weather page — status, priority, tags, people, and text search. When a filter is active, only days that have matching chits are shown. Combined with the period filter for AND logic.
- **Maps loading**: Cleaned up unused dot-animation variable. Loading toast uses CSS spinner only.
- **Mixed clusters**: Simplified to reliable "X/Y" text format (e.g., "3/2" for 3 chits and 2 contacts) instead of positioned divs that conflicted with CSS classes.

## 20260503.1116

- Header bottom border on maps and weather pages now stops at the sidebar edge instead of extending underneath it.
- Weather page sidebar filters (status, tags, priority, people, text search) now filter which forecast days are shown.
- Mixed map clusters now display a clean "X/Y" (chits/contacts) text format instead of positioned divs.
- Removed unused `_mapsLoadingDotCount` variable and outdated loading indicator comment in maps.js.

## 20260503.1107

— Sidebar Border, Weather Filtering, Map Fixes

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

## 20260503.1106

Batch of UI fixes: restored sidebar right border on maps and weather pages, fixed weather content overlapping sidebar with proper margin-left transition, implemented weather period filtering to actually show/hide day blocks by date range, replaced maps loading dots animation with a unified CSS spinner, made map marker tooltips permanent (hiding on popup open), improved mixed cluster display with separate chit/contact count badges, and moved the "All People" checkbox from the sidebar to the header next to the mode toggle.

## 20260503.1058

— Maps Marker Interactions

- **Popup icons**: Restored all calendar-supported indicator icons in map popups (alerts, recurring, checklist, people, health, habit, pinned, archived, shared, status). Each icon has cursor:pointer and a descriptive tooltip on hover.
- **Cmd/Ctrl+click**: Clicking a marker on the map while holding Cmd (macOS) or Ctrl opens the chit/contact editor in a new tab instead of showing the popup.
- **Title tooltips**: Single (non-stacked) markers now show a hover tooltip with just the title. Click to see the full popup with details.
- **Mixed clusters**: When both chits and people are stacked together, the cluster shows "chitCount/contactCount" (e.g., "3/2") in a combined shape.
- **Loading toast**: Text is now left-aligned with a fixed-width inner span so it doesn't jump during the dot animation.
- **People "All" checkbox**: Added an "All" checkbox next to the People filter label. When checked, shows all people regardless of date filters.

## 20260503.1057

Maps popup icons now show the full set of calendar-supported indicators (alerts, recurrence, checklist, people, health, habit, pinned, archived, shared, status). Cmd/Ctrl+click on map markers opens the chit or contact in a new tab. Single markers show a title tooltip on hover. Mixed clusters display chit/contact counts in "3/2" format. Loading toast text no longer jumps during dot animation. Added "All" checkbox to the People filter for showing all contacts regardless of date filters.

## 20260503.1051

— Weather Period Options

- Renamed "All (16 days)" to "Forecast Max (16 day)" in the weather sidebar period dropdown
- Added "X Days" period option that uses the user's custom days count from settings (capped at 16 for the weather forecast API limit)
- X Days navigates in chunks of X days with the prev/next arrows

## 20260503.1023

— Weather Sidebar Filters, Maps Navigation Fixes

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

## 20260503.1022

## Release 20260503.1022

Weather page sidebar now shows period dropdown, date nav, and filters instead of hiding them. Maps loading toast has fixed sizing. Cmd/Ctrl+click on map popup links opens in new tab. Map popup icons trimmed to only alerts, people, pinned, and status. Maps prev/next arrows now navigate time periods with offset tracking. Maps period dropdown renamed "Today" to "Day".

## 20260503.1014

— Settings Subsection Collapsing, Maps Cleanup

**Settings page:**
- Fixed collapsible sections: each subsection (setting-subheader) is now independently collapsible with its own ▼/▶ indicator. The h3 box title still collapses the whole box. Subsection collapsed state persists separately to localStorage. Boxes shrink to fit when subsections are collapsed.

**Maps page:**
- Removed the entire bottom status bar (legends, loading indicator). Loading now shows as a floating toast overlay centered at the top of the map.
- Added "Today" period option to the dropdown.
- Removed "No Status" row from chit popups. Status icon now appears in the icons row only when the chit has a real status.
- Removed legend management functions (no longer needed without the status bar).
- Mode switching properly clears both marker groups before re-rendering.

## 20260503.1013

Settings page subsections (`.setting-subheader`) are now independently collapsible with ▼/▶ indicators and localStorage persistence. Maps status bar removed and replaced with a floating toast loading indicator. Added "Today" period option to maps sidebar dropdown. Chit popup no longer shows a "No Status" row — status is now shown as an icon in the icons row only when a real status exists. Removed legend functions and HTML from maps page.

## 20260503.1002

— Settings Restructure, Maps Improvements, Weather Sidebar

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

## 20260503.1000

Settings page restructured: General Settings split into ⚙️ General and 🕐 Clocks subsections, Time Format moved into Clocks, "Hide declined chits" moved to Display Options. Time Periods split into Calendar Settings and Enabled Periods subsections. Maps popup now shows indicator icons (alerts, recurring, checklist, people, pinned, archived, habit, shared). Maps sidebar border removed, Order dropdown hidden, date range display added between period arrows, and mode switching now properly clears all markers before re-rendering.

## 20260503.0948

— Maps Sidebar Fixes

- Maps header now matches the dashboard height (100px) so the logo is no longer truncated
- Swapped Maps and Clock buttons in the shared sidebar — Maps/Weather are now on the first row, Clock/Kiosk on the second
- Clear All button is now a half-width button next to the Filters toggle (instead of a separate hidden section below). Shows automatically when any filter is active, works on both dashboard and maps pages
- Show/Hide and Reset Defaults buttons moved to a separate row below filters

## 20260503.0941

— Collapsible Settings Sections

Every section on the settings page is now collapsible. Click any section header (h3) to collapse or expand it. Collapsed state persists to localStorage so your preferences are remembered across page loads. A ▼/▶ arrow indicator shows the current state.

## 20260503.0938

— Maps Sidebar Styling Fix

Added missing `styles-variables.css` and `styles-layout.css` to the maps page so the shared sidebar gets the same CSS variables and button styles as the dashboard. The sidebar was missing its background color, border, and action button styling because those depend on CSS custom properties (`--sidebar-bg`, `--btn-bg`, etc.) defined in `styles-variables.css`.

## 20260503.0936

— Geography Settings

Combined the "Saved Locations" and "Map Settings" boxes on the settings page into a single "Geography" group. Map Settings appears first as a sub-header, with Saved Locations underneath.

## 20260503.0931

## Release 20260503.0931

Added a "Power of One System" section to the primary README explaining the synergies unlocked by CWOC's unified chit model — shopping lists on maps, multi-city weather packing, and contacts alongside calendar events.

## 20260503.0930

— Shared Sidebar

Extracted the dashboard sidebar into a shared component (`shared-sidebar.js`) that dynamically injects and initializes the sidebar on any page with `data-sidebar="true"` on `<body>`. The dashboard's `main-sidebar.js` is now a thin wrapper registering dashboard-specific callbacks, and the maps page replaces its custom sidebar with the shared one. Both pages share the same sidebar toggle state via localStorage, the same notification inbox, and the same filter/collapse behavior. No visual changes — the sidebar looks and works identically to before on both pages.

## 20260503.0806

Maps page major refactor: shared header via .settings-panel (shared-page.js injects standard header with logo, nav, profile menu; mode toggle injected dynamically into center). Shared sidebar filters via extracted CwocSidebarFilter class (new shared-sidebar-filter.js used by both dashboard and maps). Period dropdown replaces date range inputs (This Week/Month/Quarter/Year/All Time, default Week). Chit markers now use the chit's own color (neutral tan fallback), with red cluster borders for Blocked and orange for overdue. Loading indicator styled as parchment notification badge with fixed-width span. Updated legend with chit color swatch + blocked/overdue outline indicators.

## 20260503.0804

Major maps page refactor: switched to shared header via `.settings-panel` (shared-page.js auto-injects logo, nav, profile menu), replaced date range From/To inputs with a period dropdown (This Week/Month/Quarter/Year/All Time), colored chit markers by their actual chit color instead of status, added blocked (red border) and overdue (orange border) indicators on cluster icons, extracted `CwocSidebarFilter` into a shared file (`shared-sidebar-filter.js`) for reuse across dashboard and maps, replaced hand-coded tag/people chip filters with `CwocSidebarFilter` instances, and styled the loading indicator as a parchment notification badge with fixed-width text.

## 20260503.0745

Maps page: added status bar at the bottom with legend (left), animated loading indicator (center, cycles "Loading." → "Loading.." → "Loading..."), and standard page title with version (right). Added "Both" mode to the Chits/People toggle that shows both marker types simultaneously with both filter panels and both legends visible. Loading indicator shows during fetch and geocoding operations.

## 20260503.0738

Swapped marker and cluster shapes on the maps page: people/contacts are now circles (circleMarker + round clusters), chits are now rounded squares (divIcon + rounded-square clusters). Mixed clusters show a circle stacked on top of a square, each with its own count. Updated legend swatches to match (rounded squares for chit statuses, circle for contacts).

## 20260503.0732

Maps View Overhaul fixes: map now fills the full browser viewport (fixed body flex alignment that was centering/constraining the layout). Added `position: relative` to the header for proper mode toggle centering, reset inherited global h2 styles. Mixed cluster markers now show dual count (chits/contacts, e.g. "42/5"). Added "View in Context" buttons (fa-circle-nodes icon) to the contact editor address rows and chit editor location zone — opens the maps page centered and zoomed on that address. Maps page handles `focus` and `address` query parameters to geocode and center with a temporary highlight marker.

## 20260503.0730

## Release 20260503.0730

Added "View in Context" buttons to both the contact editor (next to each address field) and the chit editor (in the location zone header) that navigate to the maps page centered on the address. Mixed cluster markers on the maps page now show a dual count (chits/contacts) instead of a single total. The maps page handles `focus` and `address` query parameters to geocode and center on a specific location with a temporary highlight marker.

## 20260503.0718

Maps View Overhaul — redesigned the /maps page with a collapsible left sidebar for filters, maximized full-viewport map area, mode toggle relocated to the header, semi-transparent people markers, square cluster icons with distinct color schemes (amber/brown for chits, teal for people, purple for mixed), browser fullscreen mode, a default view reset button, configurable map start settings (auto-zoom, custom center/zoom) in the Settings page, and responsive mobile layout with sidebar overlay and backdrop.
