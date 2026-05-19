# Settings — Views Tab

**Category:** Standalone Pages
**Item #:** 35
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Omni View Section
- [ ] omni-hst-clock-mode (select) — HST Bar Clock mode (Both/HST Only/System Time Only)
- [ ] _openOmniLayoutModal() button — "🔮 Arrange Omni Layout" button
- [ ] omni-bundle-toggles container — checkboxes for email bundles in Omni View
- [ ] _loadOmniBundleToggles() — fetches bundles from settings, renders checkboxes
- [ ] _saveOmniBundleToggles() — PUTs omni_view flag for each changed bundle
- [ ] omni-email-count (select) — Emails to show per page (3/5/10/15/20)
- [ ] omni-color-mode (select) — Color mode (Colored/Normalized/Mono)
- [ ] omni-locked-filters-display — shows current locked filter summary text
- [ ] _renderOmniLockedFilters(settings) — renders locked filter display from settings
- [ ] _clearOmniLockedFilters() button — "🗑️ Clear Defaults" button
- [ ] _resetOmniViewDefaults() button — "↩️ Reset Omni View to Defaults" button

### Omni Layout Modal
- [ ] omni-layout-modal — modal overlay for layout configuration
- [ ] _openOmniLayoutModal() — shows the modal
- [ ] _closeOmniLayoutModal() — hides the modal
- [ ] _renderOmniLayoutGrid() — renders full-width, left column, right column, and unused zones
- [ ] _buildOmniLayoutCard(area) — creates a draggable card for each layout area
- [ ] _setupOmniDragListeners() — wires drag-and-drop between zones
- [ ] _recalcOmniPositions(insertIdx, targetZone, droppedArea) — recalculates positions after drop
- [ ] _getDefaultOmniLayout() — returns default layout configuration
- [ ] _loadOmniLayout(settings) — loads saved layout from settings, merges with defaults
- [ ] _collectOmniLayout() — serializes current layout state to JSON for saving
- [ ] _omniLayoutAreas array — 13 configurable areas (hst, weather, hst_weather, hst_temp_strip, events_weather, chrono, reminders, ondeck, soon, email, pinned_notes, pinned_checklists, pinned_all)
- [ ] Hide-when-empty toggle (eye icon) per card — toggles hideWhenEmpty flag

### Arrange Views Modal
- [ ] arrange-views-modal — modal for reordering dashboard tab bar
- [ ] _openArrangeViewsModal() — opens the arrange views modal
- [ ] _cancelArrangeViews() — closes without saving
- [ ] Drag-and-drop reordering of view tabs
- [ ] Hidden views zone — drag tabs here to hide them
- [ ] Fixed "Omni" tab (locked, cannot be moved)
- [ ] _collectViewOrder() — gathers current view order for saving

### Calendar Section
- [ ] week-start-day (select) — Week Starts On (Sun–Sat)
- [ ] all-view-start-hour (select) — View Hours start (0–23)
- [ ] all-view-end-hour (select) — View Hours end (1–24)
- [ ] _initHourDropdownPair('all-view-start-hour', 'all-view-end-hour', ...) — populates hour dropdowns
- [ ] _syncHourDropdowns(startId, endId) — disables invalid options to prevent start >= end
- [ ] day-scroll-to-hour (select) — Scroll to hour (0–12)

### Enabled Periods (Checkboxes)
- [ ] period-cb[value="Itinerary"] — Itinerary checkbox
- [ ] period-cb[value="Day"] — Day checkbox
- [ ] period-cb[value="Week"] — Week checkbox
- [ ] period-cb[value="Month"] — Month checkbox
- [ ] period-cb[value="Year"] — Year checkbox
- [ ] period-cb[value="SevenDay"] — X Days checkbox (onchange: _toggleXDaysConfig)
- [ ] period-cb[value="Work"] — Work Hours checkbox (onchange: _toggleWorkConfig)

### X Days Config
- [ ] xdays-config container — shown/hidden based on SevenDay checkbox
- [ ] custom-days-count (number input) — X Days Count (2–30)
- [ ] _toggleXDaysConfig() — shows/hides X Days config based on checkbox

### Work Config
- [ ] work-config container — shown/hidden based on Work checkbox
- [ ] _toggleWorkConfig() — shows/hides Work config based on checkbox
- [ ] Work day checkboxes (Sun–Sat) — .work-day-cb checkboxes
- [ ] work-start-hour (select) — Work Hours start
- [ ] work-end-hour (select) — Work Hours end
- [ ] _initHourDropdownPair('work-start-hour', 'work-end-hour', ...) — populates work hour dropdowns

### Habits Section
- [ ] habits-success-window (select) — Success rate window (7/30/90/all)
- [ ] default-show-habits-on-calendar (checkbox) — Default: show habits on calendar

### Projects Section
- [ ] projects-show-child-count (checkbox) — Show child chit count on project masters
- [ ] projects-show-checklist-count (checkbox) — Show aggregate checklist progress on project masters

### Maps Section
- [ ] map-auto-zoom (checkbox) — Auto-zoom to markers on load (onchange: _toggleMapAutoZoom)
- [ ] _toggleMapAutoZoom() — enables/disables custom view inputs based on auto-zoom
- [ ] map-default-lat (number input) — Default Latitude
- [ ] map-default-lon (number input) — Default Longitude
- [ ] map-default-zoom (number input) — Default Zoom (1–18)
- [ ] _loadMapSettings(settings) — populates map settings from loaded data
- [ ] _collectMapSettings() — gathers map settings with validation (lat -90..90, lon -180..180, zoom 1..18)
