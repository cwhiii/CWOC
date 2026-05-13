# Omni View — Tasks

## Task 1: Hotkey Reshuffle
- [ ] Update `shared-hotkeys.js`: add `o: 'Omni'` to `_cwocHotkeyTabMap`, remove `s` → Settings from `_cwocHandleActionHotkey`, add `F9` → Settings
- [ ] Update `main-init.js`: change `keyLower === 'o'` (Order) to `keyLower === 's'` (Sort), remove old `'o'` handler
- [ ] Update `main-hotkeys.js`: any references to the old `O` key for Order
- [ ] Update the reference overlay HTML in `index.html` to show new mappings: `O` → Omni, `S` → Sort, `F9` → Settings
- [ ] Verify `F10` → Rules still works unchanged

## Task 2: Backend — Bundle `omni_view` Column
- [ ] Add migration in `migrations.py`: `ALTER TABLE bundles ADD COLUMN omni_view INTEGER DEFAULT 0` (with existence check)
- [ ] Call the new migration function in `main.py` startup sequence
- [ ] Update `PUT /api/bundles/{id}` in `routes/bundles.py` to accept and persist `omni_view` field
- [ ] Verify `GET /api/bundles` already returns the new column (SQLite `SELECT *` will include it)

## Task 3: Backend — Omni View Settings Fields
- [ ] Add migration for `omni_layout` (TEXT, default NULL) and `omni_locked_filters` (TEXT, default NULL) columns on `settings` table
- [ ] Verify these are returned by `GET /api/settings/default_user` and saveable via `POST /api/settings`

## Task 4: "Omni" Header Button
- [ ] In `index.html`, wrap the word "Omni" in the `<h1>` with a clickable `<span>` (e.g., `<span id="omni-trigger" class="omni-header-btn">Omni</span> Chits`)
- [ ] Add CSS for `.omni-header-btn`: cursor pointer, subtle hover underline/color shift, no visual disruption when inactive
- [ ] Add click handler: sets `_omniViewActive = true`, calls `displayChits()` (which routes to `displayOmniView`)
- [ ] When Omni View is active, remove `.active` class from all C CAPTN tabs

## Task 5: Omni View Core Rendering (`main-omni.js`)
- [ ] Create `src/frontend/js/dashboard/main-omni.js`
- [ ] Implement `displayOmniView(filteredChits)`:
  - Load layout config from settings (or use defaults)
  - Build two-column container (CSS Grid or Flexbox)
  - Route to section renderers based on config
- [ ] Implement deduplication algorithm:
  - Separate email chits first
  - Categorize remaining into Chrono/OnDeck/Soon (reuse itinerary logic)
  - Remaining pinned → Pinned Notes or Pinned Checklists
- [ ] Add `<script>` tag in `index.html` (after `main-calendar.js`, before `main-init.js`)

## Task 6: Omni View — Itinerary Sections
- [ ] Implement Chrono Anchored section: reuse `_buildItineraryEvent()` with time-until badges
- [ ] Implement On Deck section: reuse `_buildItineraryEvent()` and `_buildItineraryHabitCard()` with habit streak counters
- [ ] Implement Soon section: reuse `_buildItineraryEvent()` with due-date badges
- [ ] Time-until badges: calculate minutes/hours until event, format as "in Xm" / "in Xh Ym", update every 60s
- [ ] Habit streak counters: calculate consecutive successful periods, display as 🔥 N

## Task 7: Omni View — HST Bar
- [ ] Implement `_renderOmniHST(chronoItems, weatherHourly)`:
  - Bar container with same fill gradient as `_renderHSTClock`
  - Fill up to current time percentage
  - Place chit type icons at time positions
  - Place weather icons at hour positions
  - Crowding detection: if icons < 20px apart, collapse chits to vertical lines
  - Tooltips on all icons/lines
  - Click chit icon → quick-edit; click weather icon → `_openWeatherModal()`
  - Mobile: long-press weather → `_openWeatherModal()`
- [ ] 1-second update interval for fill animation
- [ ] Fetch hourly weather data for icon placement (reuse existing weather fetch infrastructure)

## Task 8: Omni View — Weather Bar
- [ ] Implement weather bar section: current temp, high/low, conditions icon, location name
- [ ] Reuse `_getWeatherIcon()`, `_celsiusToFahrenheit()`, existing weather data from `_cwocSettings` or cached weather
- [ ] Click → `_openWeatherModal()`

## Task 9: Omni View — Pinned Sections
- [ ] Implement Pinned Notes section: filter pinned chits that are notes (no dates, no checklist, has content)
- [ ] Implement Pinned Checklists section: filter pinned chits with checklist items
- [ ] Render using existing card builders from Notes view and Checklists view respectively
- [ ] Ensure inline checklist toggle works in Pinned Checklists section

## Task 10: Omni View — Email Section
- [ ] Implement `_renderOmniEmail()`:
  - Filter global chits for: `email_message_id` present, `email_read === false`, tags include an Omni-enabled bundle tag
  - Sort by `email_date` descending
  - Paginate: show 3 at a time
  - Render each with `_buildEmailCard(chit, viSettings)` (full reuse)
  - "Next 3" / "Previous 3" buttons (replace, don't append)
- [ ] Reset pagination to page 0 on Omni View entry
- [ ] Fetch Omni-enabled bundles from `GET /api/bundles` (filter where `omni_view === 1`)
- [ ] Attach swipe handlers (already built into `_buildEmailCard`)

## Task 11: Omni View — Filtering
- [ ] On Omni View entry: reset sidebar filters (or apply locked defaults if set)
- [ ] Ensure `displayOmniView` receives already-filtered chits from the standard filter pipeline
- [ ] Add 🔒 "Lock Filters" button to sidebar when Omni View is active
- [ ] Implement `_lockOmniFilters()`: gather current filter state, save to settings as `omni_locked_filters`
- [ ] Show brief toast confirmation on lock

## Task 12: Omni View CSS (`styles-omni.css`)
- [ ] Create `src/frontend/css/dashboard/styles-omni.css`
- [ ] Two-column grid layout (configurable via data attributes or classes)
- [ ] HST bar styling (full-width, gradient, icon positioning, vertical line fallback)
- [ ] Weather bar styling
- [ ] Section containers with itinerary-matching headers
- [ ] Email pagination buttons styling
- [ ] Time-until badge styling
- [ ] Habit streak badge styling
- [ ] Lock button styling
- [ ] Responsive: single-column below 768px
- [ ] Add `<link>` in `index.html`

## Task 13: Bundle Editor — "Include in Omni View" Checkbox
- [ ] In `main-email-bundles.js` `_openBundleModal()`: add checkbox for "Include in Omni View"
- [ ] On bundle save: include `omni_view` field in the PUT/POST request
- [ ] On bundle edit load: set checkbox state from bundle data

## Task 14: Settings Page — Omni View Config Section
- [ ] Add "🔮 Omni View" setting group in `settings.html`
- [ ] Layout configurator: draggable cards for 8 areas, width toggle (half/full), visibility toggle
- [ ] Bundle Omni View toggles: list all bundles with checkboxes
- [ ] Locked filter defaults display with "Clear Defaults" button
- [ ] Wire up in `settings.js`: load/save `omni_layout`, `omni_locked_filters`, bundle `omni_view` flags
- [ ] Reuse existing drag-and-drop pattern from clock format grid

## Task 15: Integration into `displayChits()` Switch
- [ ] In `main-init.js` `displayChits()`: add `case 'Omni': displayOmniView(filteredChits); break;`
- [ ] When switching to Omni: set `currentTab = 'Omni'`, deactivate all tab highlights
- [ ] When switching away from Omni: set `_omniViewActive = false`

## Task 16: Mobile Optimization
- [ ] Verify single-column stack on mobile
- [ ] Verify email swipe works in Omni context
- [ ] Add long-press handler on weather icons for mobile (500ms threshold → `_openWeatherModal()`)
- [ ] Verify HST bar scales properly on narrow screens
- [ ] Verify "Omni" header button is tappable on mobile

## Task 17: Help & Reference Updates
- [ ] Update help page (`help.html`) with Omni View documentation
- [ ] Update reference overlay with new hotkey mappings
- [ ] Document the Omni View concept, sections, and configuration options

## Task 18: Index & Version (do last)
- [ ] Update `src/INDEX.md` with new files and functions
- [ ] Update `src/VERSION` with current timestamp
- [ ] Write release notes file
