# Implementation Plan

## Overview
Implement the Omni View — a command-center dashboard that fuses the itinerary view, pinned chits, and unread email into a single actionable view. Triggered by clicking "Omni" in the header or pressing the `O` hotkey.

## Tasks

- [x] 1. Hotkey Reshuffle
  - [x] 1.1. Update `shared-hotkeys.js`: add `o: 'Omni'` to `_cwocHotkeyTabMap`, remove `s` → Settings from `_cwocHandleActionHotkey`, add `F9` → Settings
  - [x] 1.2. Update `main-init.js`: change `keyLower === 'o'` (Order) to `keyLower === 's'` (Sort), remove old `'o'` handler
  - [x] 1.3. Update `main-hotkeys.js`: any references to the old `O` key for Order
  - [x] 1.4. Update the reference overlay HTML in `index.html` to show new mappings: `O` → Omni, `S` → Sort, `F9` → Settings
  - [x] 1.5. Verify `F10` → Rules still works unchanged

- [x] 2. Backend — Bundle `omni_view` Column
  - [x] 2.1. Add migration in `migrations.py`: `ALTER TABLE bundles ADD COLUMN omni_view INTEGER DEFAULT 0` (with existence check)
  - [x] 2.2. Call the new migration function in `main.py` startup sequence
  - [x] 2.3. Update `PUT /api/bundles/{id}` in `routes/bundles.py` to accept and persist `omni_view` field
  - [x] 2.4. Verify `GET /api/bundles` already returns the new column (SQLite `SELECT *` will include it)

- [x] 3. Backend — Omni View Settings Fields
  - [x] 3.1. Add migration for `omni_layout` (TEXT, default NULL) and `omni_locked_filters` (TEXT, default NULL) columns on `settings` table
  - [x] 3.2. Verify these are returned by `GET /api/settings/default_user` and saveable via `POST /api/settings`

- [x] 4. "Omni" Header Button
  - [x] 4.1. In `index.html`, wrap the word "Omni" in the `<h1>` with a clickable `<span>` (e.g., `<span id="omni-trigger" class="omni-header-btn">Omni</span> Chits`)
  - [x] 4.2. Add CSS for `.omni-header-btn`: cursor pointer, subtle hover underline/color shift, no visual disruption when inactive
  - [x] 4.3. Add click handler: sets `_omniViewActive = true`, calls `displayChits()` (which routes to `displayOmniView`)
  - [x] 4.4. When Omni View is active, remove `.active` class from all C CAPTN tabs

- [x] 5. Omni View Core Rendering (`main-omni.js`)
  - [x] 5.1. Create `src/frontend/js/dashboard/main-omni.js`
  - [x] 5.2. Implement `displayOmniView(filteredChits)`: Load layout config from settings (or use defaults), build two-column container (CSS Grid or Flexbox), route to section renderers based on config
  - [x] 5.3. Implement deduplication algorithm: Separate email chits first, categorize remaining into Chrono/OnDeck/Soon (reuse itinerary logic), remaining pinned → Pinned Notes or Pinned Checklists
  - [x] 5.4. Add `<script>` tag in `index.html` (after `main-calendar.js`, before `main-init.js`)

- [x] 6. Omni View — Itinerary Sections
  - [x] 6.1. Implement Chrono Anchored section: reuse `_buildItineraryEvent()` with time-until badges
  - [x] 6.2. Implement On Deck section: reuse `_buildItineraryEvent()` and `_buildItineraryHabitCard()` with habit streak counters
  - [x] 6.3. Implement Soon section: reuse `_buildItineraryEvent()` with due-date badges
  - [x] 6.4. Time-until badges: calculate minutes/hours until event, format as "in Xm" / "in Xh Ym", update every 60s
  - [x] 6.5. Habit streak counters: calculate consecutive successful periods, display as 🔥 N

- [x] 7. Omni View — HST Bar
  - [x] 7.1. Implement `_renderOmniHST(chronoItems, weatherHourly)`: Bar container with same fill gradient as `_renderHSTClock`, fill up to current time percentage, place chit type icons at time positions, place weather icons at hour positions, crowding detection (if icons < 20px apart collapse chits to vertical lines), tooltips on all icons/lines, click chit icon → quick-edit, click weather icon → `_openWeatherModal()`, mobile long-press weather → `_openWeatherModal()`
  - [x] 7.2. 1-second update interval for fill animation
  - [x] 7.3. Fetch hourly weather data for icon placement (reuse existing weather fetch infrastructure)

- [x] 8. Omni View — Weather Bar
  - [x] 8.1. Implement weather bar section: current temp, high/low, conditions icon, location name
  - [x] 8.2. Reuse `_getWeatherIcon()`, `_celsiusToFahrenheit()`, existing weather data from `_cwocSettings` or cached weather
  - [x] 8.3. Click → `_openWeatherModal()`

- [x] 9. Omni View — Pinned Sections
  - [x] 9.1. Implement Pinned Notes section: filter pinned chits that are notes (no dates, no checklist, has content)
  - [x] 9.2. Implement Pinned Checklists section: filter pinned chits with checklist items
  - [x] 9.3. Render using existing card builders from Notes view and Checklists view respectively
  - [x] 9.4. Ensure inline checklist toggle works in Pinned Checklists section

- [x] 10. Omni View — Email Section
  - [x] 10.1. Implement `_renderOmniEmail()`: Filter global chits for `email_message_id` present, `email_read === false`, tags include an Omni-enabled bundle tag. Sort by `email_date` descending. Paginate: show 3 at a time. Render each with `_buildEmailCard(chit, viSettings)` (full reuse). "Next 3" / "Previous 3" buttons (replace, don't append)
  - [x] 10.2. Reset pagination to page 0 on Omni View entry
  - [x] 10.3. Fetch Omni-enabled bundles from `GET /api/bundles` (filter where `omni_view === 1`)
  - [x] 10.4. Attach swipe handlers (already built into `_buildEmailCard`)

- [x] 11. Omni View — Filtering
  - [x] 11.1. On Omni View entry: reset sidebar filters (or apply locked defaults if set)
  - [x] 11.2. Ensure `displayOmniView` receives already-filtered chits from the standard filter pipeline
  - [x] 11.3. Add 🔒 "Lock Filters" button to sidebar when Omni View is active
  - [x] 11.4. Implement `_lockOmniFilters()`: gather current filter state, save to settings as `omni_locked_filters`
  - [x] 11.5. Show brief toast confirmation on lock

- [x] 12. Omni View CSS (`styles-omni.css`)
  - [x] 12.1. Create `src/frontend/css/dashboard/styles-omni.css`
  - [x] 12.2. Two-column grid layout (configurable via data attributes or classes)
  - [x] 12.3. HST bar styling (full-width, gradient, icon positioning, vertical line fallback)
  - [x] 12.4. Weather bar styling
  - [x] 12.5. Section containers with itinerary-matching headers
  - [x] 12.6. Email pagination buttons styling
  - [x] 12.7. Time-until badge styling
  - [x] 12.8. Habit streak badge styling
  - [x] 12.9. Lock button styling
  - [x] 12.10. Responsive: single-column below 768px
  - [x] 12.11. Add `<link>` in `index.html`

- [x] 13. Bundle Editor — "Include in Omni View" Checkbox
  - [x] 13.1. In `main-email-bundles.js` `_openBundleModal()`: add checkbox for "Include in Omni View"
  - [x] 13.2. On bundle save: include `omni_view` field in the PUT/POST request
  - [x] 13.3. On bundle edit load: set checkbox state from bundle data

- [x] 14. Settings Page — Omni View Config Section
  - [x] 14.1. Add "🔮 Omni View" setting group in `settings.html`
  - [x] 14.2. Layout configurator: draggable cards for 8 areas, width toggle (half/full), visibility toggle
  - [x] 14.3. Bundle Omni View toggles: list all bundles with checkboxes
  - [x] 14.4. Locked filter defaults display with "Clear Defaults" button
  - [x] 14.5. Wire up in `settings.js`: load/save `omni_layout`, `omni_locked_filters`, bundle `omni_view` flags
  - [x] 14.6. Reuse existing drag-and-drop pattern from clock format grid

- [x] 15. Integration into `displayChits()` Switch
  - [x] 15.1. In `main-init.js` `displayChits()`: add `case 'Omni': displayOmniView(filteredChits); break;`
  - [x] 15.2. When switching to Omni: set `currentTab = 'Omni'`, deactivate all tab highlights
  - [x] 15.3. When switching away from Omni: set `_omniViewActive = false`

- [x] 16. Mobile Optimization
  - [x] 16.1. Verify single-column stack on mobile
  - [x] 16.2. Verify email swipe works in Omni context
  - [x] 16.3. Add long-press handler on weather icons for mobile (500ms threshold → `_openWeatherModal()`)
  - [x] 16.4. Verify HST bar scales properly on narrow screens
  - [x] 16.5. Verify "Omni" header button is tappable on mobile

- [x] 17. Help & Reference Updates
  - [x] 17.1. Update help page (`help.html`) with Omni View documentation
  - [x] 17.2. Update reference overlay with new hotkey mappings
  - [x] 17.3. Document the Omni View concept, sections, and configuration options

- [x] 18. Index & Version (do last)
  - [x] 18.1. Update `src/INDEX.md` with new files and functions
  - [x] 18.2. Update `src/VERSION` with current timestamp
  - [x] 18.3. Write release notes file

## Task Dependency Graph
```
1 (Hotkey Reshuffle)
2 (Backend — Bundle omni_view Column)
3 (Backend — Omni View Settings Fields)
4 (Omni Header Button) → depends on 1
5 (Omni View Core Rendering) → depends on 3, 12
6 (Itinerary Sections) → depends on 5
7 (HST Bar) → depends on 5
8 (Weather Bar) → depends on 5
9 (Pinned Sections) → depends on 5
10 (Email Section) → depends on 2, 5
11 (Filtering) → depends on 3, 5
12 (Omni View CSS)
13 (Bundle Editor Checkbox) → depends on 2
14 (Settings Page Config) → depends on 2, 3
15 (displayChits Integration) → depends on 4, 5
16 (Mobile Optimization) → depends on 5, 7, 8, 10, 12
17 (Help & Reference) → depends on 1, 15
18 (Index & Version) → depends on 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17
```

## Notes
- Tests are optional per project rules — no test tasks included.
- No software installation required — pure code changes only.
- Reuse existing code patterns extensively per project DRY principles.
- Version update (Task 18.2) must call `date "+%Y%m%d.%H%M"` for the real timestamp.
