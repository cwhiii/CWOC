# 20260513 Highlights

- Added Print Chit feature (formatted print of all zones)
- URL hash routing for bookmarkable dashboard views
- Added habit notification direction ("Will Be Missed Within")
- Weather notifications with progressive disclosure UI

---

## 20260513.2214

Fixed color circle in Print Chit — switched from CSS background to inline SVG circle which always renders fill colors in print.

## 20260513.2213

Fixed color circle in Print Chit — added inline print-color-adjust and !important to force background-color rendering in print.

## 20260513.2212

Fixed Print Chit color circle appearing empty — added print-color-adjust: exact to force browsers to render background colors in print mode.

## 20260513.2210

Print Chit now includes the weather forecast (icon, description, high/low temps, precipitation, wind gusts, date) when weather data is available.

## 20260513.2209

## 20260513.2209 — URL Hash Routing for Bookmarkable Views

Added hash-based URL routing to the dashboard. The URL now always reflects the current tab and mode (e.g., `#calendar/day`, `#tasks/habits`, `#alarms/independent`). This enables bookmarking specific views and pinning them as standalone apps on mobile home screens. Browser back/forward navigation between hash states is also supported. Existing `?tab=` deep links (ntfy notifications) are preserved and automatically converted to hash URLs.

## 20260513.2208

Fixed Print Chit color swatch to be a round circle and display the actual color value.

## 20260513.2203

Fixed global search result cards to properly show chit colors with auto-contrasting text. Field labels in matched results now inherit the contrast color instead of using a hardcoded brown that was unreadable on dark backgrounds.

## 20260513.2200

Added "Hide ✓" checkbox inline with the Print Chit button in the options menu. When checked (default), completed checklist items are excluded from the printed output.

## 20260513.2154

Added "Print Chit" button to the editor's Options menu that prints all populated zones (dates, status, location, tags, people, notes, checklist, alerts, color, flags) in a nicely formatted layout via the browser print dialog.

## 20260513.2134

Renamed the habit notification direction label from "Will Be Missed Within" to "Habit Will Be Missed Within" for clarity.

## 20260513.2133

Fixed ampersand (`&`) in titles/content breaking global search. A lone `&` in the query caused an infinite loop in the frontend term extractor, and the highlight function failed to match terms containing `&` against HTML-escaped text.

## 20260513.2130

Added "Will Be Missed Within" as a new notification direction type for habit chits. When selected, you specify a number and time unit (e.g., 2 hours) and the notification fires when the habit goal hasn't been met and the cycle end is approaching within that window. Automatically suppresses when the goal is already met. Backend push loop now handles habit cycle notifications server-side.

## 20260513.2110

Fixed calendar navigation (prev/next period buttons) for SevenDay, Work, and Itinerary views which previously did nothing when clicked. Also fixed SevenDay view always showing today instead of respecting the navigated date, and Itinerary view now anchors to the navigated week.

## 20260513.2102

Fixed checklist auto-save not working on mobile. The generic input listener was attached to the checklist input field, causing `setSaveButtonUnsaved()` to fire on every keystroke — this made the save/discard/cancel buttons appear and interfered with the checklist auto-save system. The checklist input is now excluded from the generic listener. Also made `cancelOrExit()` properly await pending checklist saves before navigating.

## 20260513.2102

Hide "Chits" from the header when icon-only tabs would be squished below square width, reclaiming space for the tab bar.

## 20260513.2056

Mobile editor actions sidebar reordered to: Hide in Calendar, Calculator, Snooze, Options, Exit. Removed Snooze from the Options dropdown menu (it's now directly accessible from the sidebar).

## 20260513.2054

Hide email unread badge along with tab labels in icon-only mode.

## 20260513.2051

Fixed tab overflow detection using off-screen measurement to reliably detect text clipping in flex-shrunk tabs, triggering icon-only mode correctly.

## 20260513.2049

Fixed mobile long-press on weather elements to open the quick weather modal. Replaced broken inline touch handler on HST weather icons with the standard `enableLongPress()` function, added long-press support to the Omni weather bar, and added long-press on the sidebar weather button (equivalent to shift+click on desktop).

## 20260513.2041

Added search-as-you-type (300ms debounce) to the global search, send-content modal, and send-item modal — the three remaining search inputs that previously required Enter/Go to execute.

## 20260513.2029

Auto-complete status is now ON by default for ALL chits (not just project children). The button moved from the Projects zone header to the Task zone header so it's always visible. Existing chits with no explicit setting are migrated to enabled.

## 20260513.2028

Dragging a checklist item between the active and completed zones now updates its checked state to match the target zone, triggering auto-complete evaluation when enabled.

## 20260513.2022

## 20260513.2022

Replaced trashcan emoji (🗑️) with a simple ✕ icon on checklist item delete buttons for a less obtrusive appearance.

## 20260513.2018

Fixed "Authentication required" error when clicking the Raw Email download button — switched from `window.open` (which can fail to send session cookies) to a `fetch`-based blob download that properly includes credentials.

## 20260513.1939

Mobile Overview: When start/end dates are the same, only show the date once (e.g. "2025-05-13 09:00 → 17:00" instead of repeating the date).

## 20260513.1939

Added Badges (Smart Actions) — a configurable detection system for email cards that identifies tracking numbers, flights, hotels, rental cars, events, restaurants, transit receipts, and order confirmations, then shows shield-shaped action buttons. Includes a Settings UI for enabling/disabling detectors by category, creating custom detectors with regex patterns and URL templates, and controlling max badges per email. Buttons restyled as rounded shields (flat top, rounded bottom).

## 20260513.1935

Mobile Overview: Fixed to show actual note preview (multi-line), incomplete checklist items listed out, and custom zones only display when fields have values (showing those field values inline).

## 20260513.1929

Mobile editor: Renamed "Title" zone to "Overview" — now shows a compact read-only summary of all populated chit fields (title, weather, dates, notes, checklist, location, indicators, custom zones). Tapping any row navigates directly to that zone for editing.

## 20260513.1916

All-day defaults ON when selecting a date mode. Time inputs stay visible (empty HH:MM) during initial creation so users can see them and click in. Picking a time auto-deselects all-day. Once the user explicitly toggles all-day or loads a saved chit, time inputs hide/show normally as before.

## 20260513.1911

All-day defaults ON when selecting a date mode. Time inputs show empty "HH:MM" placeholder (not pre-filled) and remain visible but dimmed. Picking a time auto-deselects all-day.

## 20260513.1907

Added PGP decryption for incoming encrypted emails. When viewing a PGP-encrypted message, a Decrypt button appears on the banner. Clicking it prompts for your account password, fetches your private key, and decrypts the message in-place using OpenPGP.js. The decrypted content is display-only and never saved to the database.

## 20260513.1902

All-day now defaults to ON when a date mode (Due, Start/End) is selected. Time inputs remain visible (dimmed) and picking a time automatically deselects all-day.

## 20260513.1900

Added "HST Weather Strip" element to the Omni View. Renders the normal HST bar with a temperature color strip underneath — 100 segments (one per HST hour), each colored using the interpolated hourly forecast temperature mapped to the standard temperature gradient. Starts in the Unused section.

## 20260513.1842

Consolidated all weather fetching into a single shared function `getWeatherForLocation()` in shared-weather.js. The Omni View weather bar, weather modal, and chit editor all now use this one function. Deleted duplicate fetch code from main-omni.js, main-modals.js, editor-location.js, and shared.js. Fixes the Omni View showing wrong-day weather (was using UTC date instead of local date for cache lookup).

## 20260513.1826

Converted settings save from INSERT OR REPLACE (full row replacement) to partial UPDATE — only fields present in the request body are now written to the database, preventing unrelated settings from being wiped by partial saves.

## 20260513.1809

Fixed saved locations being wiped on settings save. If the locations DOM has no rows (not yet rendered or JS error prevented population), the save now preserves the existing server-side location data instead of overwriting with empty.

## 20260513.1804

Added "Emails to show" setting in Omni View settings (3, 5, 10, 15, or 20 per page). Renamed the "Unread Email" section to "Email".

## 20260513.1737

Rebuilt Omni Layout arrange modal as a single ordered list. Items are dragged to reorder vertically — position in the list determines render order. L/R/Full buttons on each card control column placement. Full-width items can now be placed anywhere (top, middle, or bottom) relative to half-width items.

## 20260513.1734

Fixed Omni View layout so full-width sections can appear above OR below the two-column grid. Layout now renders in strict position order, interleaving full-width sections with column groups as needed.

## 20260513.1732

Fixed weather notifications firing for past chits. The alert push loop now skips weather alerts for chits whose end/due/start date is more than 1 hour in the past.

## 20260513.1729

Added safety guard to collectLocationsData: if the DOM has no location rows but the loaded settings had locations, preserves the original data instead of overwriting with empty. Prevents accidental location data loss on save.

## 20260513.1727

Fixed Omni View email section not showing emails. Two issues: (1) email dedup now uses global chits array instead of sidebar-filtered chits, (2) Omni View entry now auto-enables "Show Email (Received)" checkbox so email chits pass through the filter pipeline.

## 20260513.1715

Fixed bundle toggles 401 error: removed the broken separate /api/bundles fetch and now reads bundle data directly from the settings response (which already piggybacks bundles). Restored ½/Full width toggle buttons on Omni Layout cards. Removed all debug logging from middleware.

## 20260513.1711

Fixed /api/bundles 401 auth failure on settings page. Root cause: session cleanup was using a hardcoded 24h inactivity cutoff that could race with the per-request auth check, deleting sessions that the user's personal session_lifetime setting would have kept alive. Cleanup now only deletes sessions past their absolute expires_datetime. Also added secure=True to the session cookie for proper HTTPS behavior.

## 20260513.1707

Added "HST + Weather" combined section to the Omni View layout. Renders the HST bar on the left and Weather bar on the right side-by-side in a single section. Can be placed in the Full Width zone or in a left/right column. Starts in the Unused section by default.

## 20260513.1700

Rebuilt the Arrange Omni Layout modal to use explicit left/right column zones (like the Notes view masonry layout). Each column can now have an unequal number of items. Drag cards between Full Width, Left Column, Right Column, and Unused zones. Width is determined by which zone the card is in — no more manual width toggle buttons.

## 20260513.1652

Added "Pinned (Notes + Checklists)" combined section to the Omni View layout. It starts in the Unused section of the Arrange Omni Layout modal and can be dragged to active to show both pinned notes and checklists in a single group. Also ensured the layout arrangement properly applies to the Omni View rendering.

## 20260513.1424

Omni View polish: added HST bar clock format setting (HST only, System only, or Both), removed Georgia font fallback from dashboard layout and omni CSS (Lora only), made sidebar use --header-bg for consistency, enlarged weather icons on HST bar, and added descriptive weather condition tooltips.

## 20260513.1416

Omni View polish: HST bar now displays system time (left) and HST sidereal time (right) as an overlay, weather icons are vertically centered in the bar, and the h1/Omni header button explicitly uses Lora font.

## 20260513.1405

Fixed four Omni View bugs: Soon section now shows time-diff ("2 days", "3 days") instead of day names; birthday chips display at full width with content inside clip-path bounds; Chrono section shows events until they end (not just until they start); right-clicking a different chit while a context menu is open now opens the new menu instead of just closing the old one.

## 20260513.1359

Fixed five Omni View bugs: columns now scroll independently, habit cards match event widths, layout configurator is a modal, bundle toggle errors are logged with details, and layout padding/margins are tightened.

## 20260513.1353

Fixed 5 Omni View bugs: removed white background/margins so it uses full parchment space, fixed right-click context menu not closing when right-clicking elsewhere, filtered archived chits from pinned sections, reduced HST/Weather bar margins, and enabled birthday chip color and profile picture rendering in itinerary events.

## 20260513.1348

Fixed 8 Omni View bugs: header spacing between "Omni" and "Chits", habit card width overflow, pin icon now unpins chits, settings layout configurator shows 2-column grid preview, bundle toggles wait for auth before fetching, HST/weather bar overflow containment, weather icon deduplication in HST bar, and birthday chips now match full event width.

## 20260513.1052

Made chit title optional — chits can now be saved without a title. Untitled chits display as "(Untitled)" on cards and calendar events.

## 20260513.1050

Condensed weather descriptions and merged precip into description line. Descriptions now: Clear, Partly cloudy, Overcast, Fog, Rime, Drizzle, Rain, Snow, Blizzard (snow + gusts ≥56 km/h per NWS), Thunderstorm, Thunderstorm + hail. Precip amount merged inline (e.g. "Rain & warm, 2cm") — no separate precip badge. Mobile title zone: icon + description + precip on one line. Added historical weather API fallback — chit dates more than 5 days in the past now use Open-Meteo's archive API (data back to 1940).

## 20260513.0840

Consolidated temperature gradient into a single source of truth: _cwocTempGradientStops array and _buildTempGradient() function in shared-utils.js. All three places (editor bar, quick weather bar, weather page borders) now use the same gradient definition. Removed the separate _getTempBorderColor — borders now use the same colors as the bar fill.

## 20260513.0837

Removed extra borders on weather page day blocks: removed the gold box-shadow (today highlight) and the red outline (extreme weather) that were stacking on top of the gradient border.

## 20260513.0832

Fixed weather page gradient borders not showing: removed border-radius (conflicts with border-image), increased border to 3px for visibility, changed today highlight to use box-shadow instead of border-color override.

## 20260513.0829

Quick weather modal description text made smaller (0.85→0.75em). Weather page day blocks now have gradient borders: high temp color on top, low temp color on bottom, gradient on the sides (using border-image).

## 20260513.0828

Hover tooltips now show the opposite unit system on all temperature, wind, and precipitation values (editor, quick weather modal, weather page). Weather page borders now use a saturated color palette (_getTempBorderColor) so cold days show blue, warm days gold/orange, hot days red — distinct from the light parchment background.

## 20260513.0823

Quick weather modal: temps now show as "low – high" (was "high / low"), added weather description with temperature feeling (e.g. "Overcast & cold"). Weather page: temps reordered to "low – high", day block borders now colored by the gradient color for that day's high temperature. Shared helpers (_weatherDescriptions, _getTempFeeling, _getWeatherDescription, _getTempColor) moved to shared-utils.js for reuse across all pages.

## 20260513.0818

Dashboard quick-weather modal now uses the same temperature bar as the editor: matching gradient (dark blue → blue → neutral → yellow → red → dark red), mask overlays for non-forecast range, floating low/high callouts, tick marks every 10°, and 1px border.

## 20260513.0813

Weather bar gradient neutral point moved to 15°C (was 10°C). Stops now: dark blue -10, blue 0, neutral 15, yellow 22, red 30, dark red 40.

## 20260513.0811

Weather now auto-refreshes when any date field (start, due, point-in-time) changes via Flatpickr. Location changes already triggered refresh via searchLocationMap.

## 20260513.0804

Fixed weather forecast always showing today's data regardless of chit date. Now reads the chit's start/due/point-in-time date and requests that specific date's forecast from Open-Meteo.

## 20260513.0756

Temperature feeling now uses the most extreme temperature (whichever of min/max is furthest from zero) instead of the average. 36°C is now correctly "scorching" not "warm".

## 20260513.0753

Weather bar and text made larger (bar 12→16px, icon 1.5→1.8em, description 0.9→1em, callouts 0.85→0.95em). Description now includes temperature feeling based on average temp (e.g. "Overcast & scorching", "Clear sky & cool").

## 20260513.0750

Weather bar gradient: dark blue at -10, blue at 0, neutral, yellow, red at 30, dark red at 40.

## 20260513.0747

Weather bar gradient: hard blue/red split at midpoint, no blending.

## 20260513.0746

Weather bar gradient: blue → neutral → yellow → red.

## 20260513.0744

Weather bar gradient switched to Option C: dark blue → blue → green → yellow → orange → red → dark red.

## 20260513.0742

Weather bar gradient changed to Option D: dark blue → teal → gold → orange → red, avoiding the muddy purple middle.

## 20260513.0741

Added 1em side padding to weather box, and added written weather description (e.g. "Partly cloudy", "Heavy rain") derived from WMO weather codes above the temperature bar.

## 20260513.0737

Fixed weather bar border being hidden by mask (reverted mask overflow), and updated gradient to ultra dark blue at -10°C, blue at 0°C, red at 30°C, red-black at 40°C.

## 20260513.0733

Fixed weather bar not stretching to full width — the .compact-day-header needed explicit width:100% since its parent (#compactWeatherSection) uses align-items:center.

## 20260513.0726

Fixed broken weather bar layout: track now forces full-width row in flex container, temperature labels properly centered with translateX(-50%), tick marks no longer overlap, and masks cover the border properly.

## 20260513.0723

Editor weather bar: low and high temperature callouts now float directly above their positions on the bar (low on left in blue, high on right in red) instead of sitting in a separate row.

## 20260513.0722

Editor weather bar: fixed 10-degree tick marks being hidden behind the mask (z-index fix), removed the date display, and replaced the simple blue-to-red gradient with a sharper one that goes hard blue below 0°C and hard red above 30°C.

## 20260513.0717

Weather temperature bar made taller (8px → 12px) and given a 1px border in the parchment brown theme color.

## 20260513.0716

Weather temperature bar mask now uses the compactWeatherSection background color (var(--parchment-dark)) instead of a hardcoded dark brown, so the non-forecast portions blend seamlessly with the section background.

## 20260513.0711

Improved weather placeholder messages in the editor: "needs date" now uses 🗓️ icon, and "needs both" shows "🗓️ Date & location needed for weather 📍". Also fixed onClearLocation to show the specific "Add a location for weather" message when a date exists instead of the generic both-needed message.

## 20260513.0708

Fixed title vertical centering — moved accessories (owner chip, recurrence icon, nest label) inline with the title row instead of a separate row below, eliminating the extra height that was pushing the title off-center.

## 20260513.0706

Weather notifications: progressive disclosure (condition dropdown appears first, threshold/mode only after selecting a type). Renamed "wind gusts over" to "wind over" — now checks the higher of sustained wind and gusts. Added wind_speed_10m_max to all weather fetches and storage.

## 20260513.0651

Added word-break CSS rules to prevent single long words (URLs, unbroken strings) from overflowing note containers in the chit editor, rendered markdown output, and dashboard note cards/previews.

## 20260513.0642

Fixed custom zones being pushed below both columns on desktop. They were appended directly to the grid as extra grid items. Now they're placed inside column-one and column-two alternating, so they flow naturally with the other zones.

## 20260513.0639

Custom zones now start collapsed unless they have values stored in their fields. Zones with no data are collapsed by default; zones with any non-empty field value start expanded.

## 20260513.0638

Fixed custom zones rendering twice on desktop. The init code was calling _loadCustomZones({}) unconditionally, then loadChitData() called it again for existing chits — both async calls raced and both rendered panels. Now _loadCustomZones is only called at init for new chits; existing chits get it from loadChitData only.

## 20260513.0629

Fixed custom zones appearing at the bottom of the page on mobile instead of being integrated into the mobile zone sidebar. Custom zones now register with the mobile navigation system — they appear in the zone list, are hidden/shown correctly when switching zones, and are reachable via swipe navigation like all other zones.
