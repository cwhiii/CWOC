# Omni View (all 12 configurable sections)

**Category:** Dashboard Views
**Item #:** 17
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Entry Point & State Management (main-omni.js)

- [ ] `displayOmniView(filteredChits)` — Main entry point; clears intervals, resets email pagination, applies locked filters, loads layout config, builds two-column layout, routes to section renderers
- [ ] `_omniViewActive` (global state) — Boolean flag indicating Omni View is the active tab
- [ ] `_omniEmailPage` (global state) — Email pagination offset (page number)
- [ ] `_omniLockedFilters` (global state) — Persisted filter defaults object
- [ ] `_omniHSTInterval` (global state) — HST bar 1-second update interval ID
- [ ] `_omniTimeUntilInterval` (global state) — Time-until badge 60-second update interval ID
- [ ] `_omniFiltersApplied` (global state) — Flag preventing re-applying filters on every render cycle
- [ ] `_omniHSTMode` (global state) — HST bar icon mode: 'chits', 'both', 'weather', 'none'

### Default Layout Configuration (main-omni.js)

- [ ] `_omniDefaultLayout` — Array of 12 section config objects with id, width, visible, position, column, hideWhenEmpty
- [ ] `_omniSectionMeta` — Map of section IDs to display labels and icons (hst, weather, hst_weather, hst_temp_strip, chrono, reminders, ondeck, soon, email, pinned_notes, pinned_checklists, pinned_all)

### Section Building & Orchestration (main-omni.js)

- [ ] `_buildOmniSection(sectionConfig, widthClass)` — Creates a section wrapper div with header (icon + label) and content container; HST/weather sections skip the header
- [ ] `_populateOmniSections(filteredChits, visibleSections)` — Routes to individual section renderers based on section ID; handles hideWhenEmpty logic and applies color mode
- [ ] `_flushColumns()` (inner function) — Flushes accumulated half-width sections into a two-column grid container

### Deduplication Algorithm (main-omni.js)

- [ ] `_omniDeduplicateChits(filteredChits)` — Categorizes chits into sections with strict deduplication (each chit in exactly one section); returns { email, reminders, chrono, ondeck, soon, pinned_notes, pinned_checklists }
- [ ] Step 0: Separate reminder chits (notification=true, point_in_time today OR pinned)
- [ ] Step 1: Separate email chits from GLOBAL chits array (bypasses sidebar filters)
- [ ] Step 2: Categorize remaining into itinerary buckets (habits evaluated for rollover, cycle days, due dates)
- [ ] Step 3: Sort chrono by start time, soon by due date
- [ ] Step 4: Pinned chits not already placed → pinned_checklists or pinned_notes

### Color Modes (main-omni.js)

- [ ] `_omniNormalizedColorMap` — Fixed earthy tone colors per chit type (event, task, note, checklist, birthday, email, habit, reminder)
- [ ] `_applyOmniNormalizedColors()` — Walks all .chit-card elements and overrides background color based on section/chit type
- [ ] `_omniGetNormalizedColor(chit)` — Determines normalized color for a chit based on its type hierarchy
- [ ] `_applyOmniMonoColors()` — Sets all chit cards to ivory/cream (#fffaf0) background

### Chrono Anchored Section (main-omni.js)

- [ ] `_renderOmniChrono(contentEl, chronoItems, viSettings)` — Renders timed events happening today; filters out fully-ended events; adds time-until badges; sets up 60-second update interval
- [ ] `_buildTimeUntilBadge(startTime, now)` — Creates a badge span showing "now", "in Xm", or "in Xh Ym"
- [ ] `_formatTimeUntil(minutes)` — Formats minutes into readable badge string
- [ ] `_updateOmniTimeUntilBadges(contentEl)` — Updates all time-until badges every 60 seconds; removes cards for past events

### Reminders Section (main-omni.js)

- [ ] `_renderOmniReminders(contentEl, reminderChits, viSettings)` — Renders reminder cards with icon, time column, title, time-until badge, and complete button
- [ ] `_buildReminderTimeUntilBadge(targetTime, now)` — Builds badge supporting negative time for past reminders ("-Xm", "-Xh Ym")
- [ ] Reminder card click → navigate to editor
- [ ] Reminder card double-click → navigate to editor
- [ ] Reminder complete button click → undo toast with 5s countdown, then PATCH status=Complete + archived=true

### On Deck Section (main-omni.js)

- [ ] `_renderOmniOnDeck(contentEl, ondeckItems, viSettings)` — Renders all-day events today, untimed tasks due today, habits due today; adds streak badges for habits
- [ ] `_calculateHabitStreak(chit)` — Counts consecutive successful periods from recurrence_exceptions

### Soon Section (main-omni.js)

- [ ] `_renderOmniSoon(contentEl, soonItems, viSettings)` — Renders items due this week (not today); adds due-date badges and streak badges for habits
- [ ] `_buildDueDateBadge(dueDate, now)` — Creates badge showing "today", "1 day", or "X days"

### HST Bar (Horizontal Strip Timeline) (main-omni.js)

- [ ] `_renderOmniHST(contentEl, chronoItems)` — Renders full-width HST bar with gradient fill, chit icons, weather icons, time overlay, and mode cycling
- [ ] HST fill element — Gradient div whose width = current time percentage of day
- [ ] HST time overlay — Shows HST value (sd), system time, or both based on clock mode setting
- [ ] `_updateHSTFill()` (inner function) — Recalculates fill width based on current time
- [ ] `_updateHSTTime()` (inner function) — Updates time display based on omni_hst_clock_mode setting
- [ ] Chit icon positioning — Places emoji icons (☑️ for tasks, 🗓️ for events) at their scheduled time percentage
- [ ] Crowding detection — If adjacent icons < 20px apart, collapses to vertical lines
- [ ] HST chit icon/line click → showQuickEditModal for that chit
- [ ] HST bar click (on bar/fill/time) → cycles mode: chits → both → weather → none → chits
- [ ] `_applyHSTMode(iconsLayer)` — Shows/hides chit icons and weather icons based on _omniHSTMode
- [ ] `_placeOmniHSTWeather(iconsLayer)` — Async; fetches hourly weather codes from Open-Meteo API; caches in localStorage for 30 minutes
- [ ] `_renderHSTWeatherIcons(iconsLayer, codes)` — Places weather emoji icons at hour positions; only shows when weather changes from previous hour
- [ ] `_getWeatherConditionName(code)` — Returns human-readable weather condition name for WMO code
- [ ] HST weather icon click → opens weather modal (_openWeatherModal)
- [ ] HST weather icon long-press (mobile) → opens weather modal
- [ ] 1-second interval for fill animation and time update

### Weather Bar (main-omni.js)

- [ ] `_renderOmniWeather(contentEl)` — Renders compact weather strip with conditions icon, current temp, high/low, location name
- [ ] Weather bar click → opens weather modal (_openWeatherModal)
- [ ] Weather bar long-press (mobile) → opens weather modal
- [ ] Uses `getWeatherForLocation()` shared function for data
- [ ] Loading state: "⏳ Loading weather…"
- [ ] Empty state: "No location configured" or "Weather unavailable"

### HST + Weather Combo Section (main-omni.js)

- [ ] `_renderOmniHSTWeatherCombo(contentEl, chronoItems)` — Renders HST bar on left and weather bar on right, side by side

### HST Weather Strip Section (main-omni.js)

- [ ] `_renderOmniHSTTempStrip(contentEl, chronoItems)` — Renders normal HST bar with temperature color strip underneath
- [ ] `_populateHSTTempStrip(stripEl)` — Async; fetches hourly temperatures from Open-Meteo; caches in localStorage for 1 hour
- [ ] `_renderTempStripSegments(stripEl, hourlyTemps)` — Renders 100 colored segments as a smooth CSS gradient; uses _getTempColor for color mapping
- [ ] Temperature strip mousemove → tooltip showing temp + time + HST value at cursor position
- [ ] Temperature strip mouseleave → clears tooltip

### Pinned Notes Section (main-omni.js)

- [ ] `_renderOmniPinnedNotes(contentEl, pinnedNotes, viSettings)` — Renders pinned note cards with title row (icons, indicators), markdown content, and interactions
- [ ] Pin icon click → unpin (PUT /api/chits/{id} with pinned: false)
- [ ] Note content single-click → inline contentEditable editing (saves on blur via PUT)
- [ ] Note content Escape key → cancels inline edit (blur)
- [ ] Card double-click → navigate to editor
- [ ] Card Shift+click → showQuickEditModal
- [ ] Card right-click → _showChitContextMenu
- [ ] Stealth indicator (🥷) shown for owner only
- [ ] Archived indicator (📦)
- [ ] Snoozed indicator (😴)
- [ ] Alert indicators via _getAllIndicators
- [ ] Owner badge display
- [ ] Assignee badge display

### Pinned Checklists Section (main-omni.js)

- [ ] `_renderOmniPinnedChecklists(contentEl, pinnedChecklists, viSettings)` — Renders pinned checklist cards with header, interactive inline checklist, and interactions
- [ ] Uses `_buildChitHeader()` with checklistCount option
- [ ] Pin icon click → unpin (PUT /api/chits/{id} with pinned: false)
- [ ] Interactive inline checklist via `renderInlineChecklist()` (toggle items, drag-drop reorder)
- [ ] Read-only checklist display for viewer-role users (only unchecked items shown)
- [ ] Strike-out title when all checklist items checked (class: checklist-all-done)
- [ ] Card double-click → navigate to editor
- [ ] Card Shift+click → showQuickEditModal
- [ ] Card right-click → _showChitContextMenu

### Email Section (main-omni.js)

- [ ] `_renderOmniEmail(contentEl, allEmailChits)` — Renders unread emails from Omni-enabled bundles with pagination
- [ ] `_OMNI_EMAIL_PAGE_SIZE` — Page size loaded from settings (omni_email_count, default 3)
- [ ] `_getOmniEnabledBundles()` — Returns bundles where omni_view === 1; checks _emailBundlesData then _cwocSettings.bundles
- [ ] Email filtering: email_message_id present, email_read === false, tags include Omni-enabled bundle tag
- [ ] Catch-all bundle support: includes emails with NO bundle tag if catch-all is Omni-enabled
- [ ] Sort by email_date descending (most recent first)
- [ ] Pagination: "← Previous 3" button click → decrements _omniEmailPage, re-renders
- [ ] Pagination: "Next 3 →" button click → increments _omniEmailPage, re-renders
- [ ] Count indicator: "X–Y of Z unread"
- [ ] Hides section if no Omni-enabled bundles or no unread emails
- [ ] Uses `_buildEmailCard(chit, viSettings)` from main-email.js for card rendering (includes swipe handlers)

### Filter Lock System (main-omni.js)

- [ ] `_applyOmniEntryFilters()` — On Omni View entry: applies locked defaults or clears all filters; always enables "Show Email (Received)" checkbox
- [ ] `_applyLockedFiltersToSidebar(locked)` — Programmatically sets sidebar UI (statuses, priorities, tags, people, text search) from saved filter state
- [ ] `_showOmniLockedIndicator(show)` — Shows/hides 🔒 indicator near search field
- [ ] `_lockOmniFilters()` — Async; gathers current sidebar filter state, saves to backend via POST /api/settings as omni_locked_filters JSON, shows toast confirmation
- [ ] `_showOmniLockBtn()` — Shows 🔒 "Lock" button in sidebar filter header row (only when Omni View active)
- [ ] `_hideOmniLockBtn()` — Hides the lock button when leaving Omni View

### Tab Switching & Navigation (main-views.js, main-init.js)

- [ ] `filterChits('Omni')` — Sets _omniViewActive=true, removes .active from all tabs (Omni has no tab highlight), calls displayChits()
- [ ] Leaving Omni (filterChits to other tab) — Sets _omniViewActive=false, _omniFiltersApplied=false, hides locked indicator, hides lock button
- [ ] `_parseUrlHash()` — Supports 'omni' hash for URL routing (#omni)
- [ ] `_updateUrlHash()` — Updates URL hash when Omni is active
- [ ] `_updateFavicon('Omni')` — Sets favicon to cwod_logo-favicon.png

### Omni Trigger (index.html + main-init.js)

- [ ] `#omni-trigger` span element — "Omni" text in header h1, clickable to activate Omni View
- [ ] Click handler: sets _omniViewActive=true, currentTab='Omni', removes .active from all tabs, calls displayChits()

### Hotkey (shared-hotkeys.js)

- [ ] `O` key — Switches to Omni View (mapped in _tabHotkeys: { o: 'Omni' })

### Sidebar Integration (main-sidebar.js)

- [ ] `_clearAllFilters()` — When on Omni tab with custom view filters, applies them and sets _omniFiltersApplied=true
- [ ] `_applyFilterStateToSidebar(state)` — Used by omni filter lock to programmatically set sidebar state
- [ ] 🔒 Lock Filters button (id: omni-lock-btn) — Appears in sidebar filter header row only during Omni View; click calls _lockOmniFilters()
- [ ] 🔒 Locked indicator (id: omni-locked-indicator) — Shows near search field when locked defaults are active

### Settings Page — Omni View Section (settings.js + settings.html)

- [ ] `_omniLayoutAreas` — Array of 13 configurable section definitions (hst, weather, hst_weather, hst_temp_strip, events_weather, chrono, reminders, ondeck, soon, email, pinned_notes, pinned_checklists, pinned_all)
- [ ] `_omniLayoutState` — Current layout state (loaded from settings or defaults)
- [ ] `_getDefaultOmniLayout()` — Returns default layout array from _omniLayoutAreas
- [ ] `_openOmniLayoutModal()` — Shows the layout modal, renders the grid
- [ ] `_closeOmniLayoutModal()` — Hides the layout modal
- [ ] `_renderOmniLayoutGrid()` — Renders the drag-and-drop layout configurator with Full Width, Left Column, Right Column, and Unused zones
- [ ] `_buildOmniLayoutCard(area)` — Creates a draggable card with handle (☰), label, and hide-when-empty toggle button
- [ ] `_setupOmniDragListeners()` — Wires up dragstart, dragend, dragover, dragleave, drop events for all cards and zones
- [ ] `_recalcOmniPositions(insertIdx, targetZone, droppedArea)` — Recalculates all section positions after a drag-drop
- [ ] `_loadOmniLayout(settings)` — Loads saved layout from settings, merges with defaults for new sections
- [ ] `_collectOmniLayout()` — Serializes current layout state to JSON for saving
- [ ] `_loadOmniBundleToggles()` — Async; loads email bundles and renders checkboxes for Omni View inclusion
- [ ] `_saveOmniBundleToggles()` — Async; saves bundle omni_view toggles via PUT /api/bundles/{id}
- [ ] `_renderOmniLockedFilters(settings)` — Displays current locked filter defaults as text summary
- [ ] `_clearOmniLockedFilters()` — Clears locked filter display and marks for save
- [ ] `_resetOmniViewDefaults()` — Resets layout to defaults, resets clock mode, clears locked filters, shows toast
- [ ] `_omniLockedFiltersCleared` (flag) — Tracks whether locked filters were cleared (for save logic)

### Settings Page — Omni View Controls (settings.html)

- [ ] `#omni-hst-clock-mode` select — HST Bar Clock mode: "Both (System + HST)", "HST Only", "System Only"
- [ ] "🔮 Arrange Omni Layout" button — Opens the layout modal (onclick: _openOmniLayoutModal)
- [ ] `#omni-bundle-toggles` container — Checkboxes for each email bundle's Omni View inclusion
- [ ] `.omni-bundle-cb` checkboxes — Individual bundle toggle (data-bundleId, onchange: setSaveButtonUnsaved)
- [ ] `#omni-email-count` select — Emails to show per page: 1, 3, 5, 7, 10
- [ ] `#omni-color-mode` select — Color mode: "Colored", "Normalized", "Mono"
- [ ] `#omni-locked-filters-display` div — Shows current locked filter defaults text
- [ ] "🗑️ Clear Defaults" button — Clears locked filter defaults (onclick: _clearOmniLockedFilters)
- [ ] "↩️ Reset Omni View to Defaults" button — Resets all Omni settings (onclick: _resetOmniViewDefaults)
- [ ] "Omni" option in `#default-view-select` — Sets Omni as the landing view

### Omni Layout Modal (settings.html)

- [ ] `#omni-layout-modal` — Modal overlay for layout configuration
- [ ] `#omni-layout-grid` — Container for the drag-and-drop grid
- [ ] Full Width zone (data-zone="full") — Drop target for full-width sections
- [ ] Left Column zone (data-zone="left") — Drop target for left half-width sections
- [ ] Right Column zone (data-zone="right") — Drop target for right half-width sections
- [ ] Unused zone (data-zone="unused") — Drop target to hide sections
- [ ] Drag handle (☰) on each card — Initiates drag
- [ ] Hide-when-empty toggle (eye icon) on each card — Toggles hideWhenEmpty per section
- [ ] "Done" button — Closes the modal (onclick: _closeOmniLayoutModal)
- [ ] Drop highlight visual feedback (.omni-drop-highlight class)
- [ ] Insertion indicator (border-top/border-bottom on cards during dragover)

### Bundle Modal — Omni View Checkbox (index.html + main-email-bundles.js)

- [ ] `#bundleOmniViewCheck` checkbox — "Include in Omni View" toggle in bundle create/edit modal
- [ ] `_bundleModalCreate(name, description, color, omniView)` — Passes omni_view flag when creating bundle
- [ ] `_bundleModalUpdate(name, description, color, omniView)` — Passes omni_view flag when updating bundle

### Calendar Integration (main-calendar.js)

- [ ] Birthday chit handling in Omni View — Uses class "omni-contact-date" instead of "birthday-event"
- [ ] Emoji stripping from birthday titles in Omni View (removes 🎂💍🗓️)
- [ ] Omni View card order: [icon][time][title][status] (different from calendar order)
- [ ] `changePeriod('Day')` from calendar — Resets _omniViewActive=false, _omniFiltersApplied=false, hides lock btn/indicator

### CSS (styles-omni.css)

- [ ] `.omni-view` — Main container styling
- [ ] `.omni-grid` — Two-column grid layout
- [ ] `.omni-col` / `.omni-col-left` / `.omni-col-right` — Column containers
- [ ] `.omni-section` / `.omni-section-full` / `.omni-section-half` — Section wrappers
- [ ] `.omni-section-header` — Section header with icon and label
- [ ] `.omni-section-content` — Section content container
- [ ] `.omni-hst-bar` — HST bar container (full-width, relative positioning)
- [ ] `.omni-hst-fill` — Gradient fill element
- [ ] `.omni-hst-icons` — Icons layer (absolute positioned)
- [ ] `.omni-hst-time-overlay` — Time display overlay
- [ ] `.omni-hst-chit-icon` — Positioned chit emoji icons
- [ ] `.omni-hst-line` — Collapsed vertical line markers (crowded mode)
- [ ] `.omni-hst-weather-icon` — Positioned weather emoji icons
- [ ] `.omni-hst-bar-with-temp` — Taller bar variant for temp strip
- [ ] `.omni-hst-temp-strip` — Temperature color strip inside HST bar
- [ ] `.omni-weather-bar` — Weather bar container
- [ ] `.omni-weather-icon` / `.omni-weather-loading` / `.omni-weather-empty` / `.omni-weather-location` — Weather bar elements
- [ ] `.omni-hst-weather-combo` — Side-by-side HST + Weather container
- [ ] `.omni-combo-hst` / `.omni-combo-weather` — Combo section halves
- [ ] `.omni-time-badge` — Time-until badge styling
- [ ] `.omni-due-badge` — Due-date badge styling
- [ ] `.omni-streak-badge` — Habit streak badge styling
- [ ] `.omni-email-cards` — Email cards container
- [ ] `.omni-email-pagination` — Pagination button row
- [ ] `.omni-email-page-btn` — Previous/Next pagination buttons
- [ ] `.omni-email-count` — "X–Y of Z unread" count indicator
- [ ] `.omni-empty` — Empty state message styling
- [ ] `.omni-locked-indicator` — 🔒 indicator near search field
- [ ] `.omni-lock-btn` — Lock Filters button in sidebar
- [ ] `.omni-header-btn` — "Omni" text in header (clickable trigger)
- [ ] `.omni-contact-date` — Birthday/anniversary card styling in Omni View
- [ ] `.omni-pinned-all-notes` — Sub-container for notes in combined pinned section
- [ ] Responsive rules for mobile layout (stacking columns, adjusting sizes)

### Data Flow & API Integration

- [ ] Layout saved as `omni_layout` JSON string in settings (POST /api/settings)
- [ ] Locked filters saved as `omni_locked_filters` JSON string in settings
- [ ] HST clock mode saved as `omni_hst_clock_mode` in settings
- [ ] Email count saved as `omni_email_count` in settings
- [ ] Color mode saved as `omni_normalize_colors` in settings
- [ ] Bundle omni_view flag saved via PUT /api/bundles/{id}
- [ ] Weather data fetched from Open-Meteo API (hourly weathercode + temperature_2m)
- [ ] Weather cache in localStorage: `cwoc_omni_hst_hourly` (30 min TTL), `cwoc_hst_temp_strip_YYYY-MM-DD` (1 hour TTL)
- [ ] Reminder complete: PATCH /api/chits/{id}/fields with { status: 'Complete', archived: true }
- [ ] Unpin: PUT /api/chits/{id} with { pinned: false }
- [ ] Inline note edit save: PUT /api/chits/{id} with updated note field
